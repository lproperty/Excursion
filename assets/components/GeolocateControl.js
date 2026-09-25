import maplibregl from 'maplibre-gl';
import checkGeolocationSupport from '../utils/checkGeolocationSupport';
import compassHeading from '../utils/compassHeading';

// A fork of Mapbox GL JS's GeolocateControl, simplified + compass support
export default class GeolocateControl {
  _watching = false; // Has a location fix
  _watchId = null;
  _locking = false;
  _setup = false;
  _currentLocation = null;
  _buttonClicked = false;
  _orientationGranted = false;
  _deviceorientation = null; // Event name listened to for compass readings
  _heading = null;
  constructor(options) {
    this.options = Object.assign(
      {
        offset: [0, 0],
        onClick: () => {},
      },
      options,
    );
  }
  onAdd(map) {
    this._map = map;
    const container = document.createElement('div');
    container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    this._container = container;
    checkGeolocationSupport(this._setupUI);
    return this._container;
  }
  _setupUI = (supported) => {
    if (!supported) {
      console.warn('Geolocation support is not available.');
    }

    const button = document.createElement('button');
    button.className = 'maplibregl-ctrl-icon maplibregl-ctrl-custom-geolocate';
    button.type = 'button';
    button.innerHTML = `<svg viewBox="0 0 16 15" width="18" height="18">
    <path d="M.75 5.94c-.3.14-.51.33-.63.57a1.12 1.12 0 00.3 1.38c.2.17.47.26.8.27l5.54.02c.06 0 .09 0 .1.02.02.02.02.05.02.1l.02 5.5c.01.35.1.62.28.82.17.2.39.33.64.37.26.04.51-.01.77-.14.25-.14.45-.37.6-.7l5.7-12.34c.16-.32.22-.61.18-.87a1.05 1.05 0 00-.32-.65c-.17-.16-.4-.26-.67-.28-.28-.03-.58.03-.9.18L.75 5.94z"/>
    <path fill="#fff" class="inner" d="M2.37 6.74h-.02c0-.01 0-.02.02-.03l10.9-4.95h.03l-.01.03-4.97 10.88c0 .02-.01.02-.02.02v-.02l.04-5.31a.64.64 0 00-.66-.66l-5.31.04z"/>
  </svg>`;
    button.addEventListener('click', this._clickButton, false);
    this._button = button;
    this._container.appendChild(this._button);

    const dot = document.createElement('div');
    dot.innerHTML = `<div class="user-location-dot"></div>
      <div class="user-location-compass" hidden></div>`;
    // <div class="user-location-accuracy"></div>`;
    dot.className = 'user-location';
    this._dot = new maplibregl.Marker({
      element: dot,
    });
    const dotElement = this._dot.getElement();
    this._compass = dotElement.querySelector('.user-location-compass');
    // this._accuracy = dotElement.querySelector('.user-location-accuracy');

    this._map.on('movestart', (e) => {
      if (!e.geolocateSource && this._locking) {
        this._locking = false;
        this._updateButtonState(null);
      }
    });
    // Keep the cone pointing the right way when the map is rotated
    this._map.on('rotate', this._updateCompass);

    this._setup = true;

    if (supported === 'granted') this._clickButton(null, false);
  };
  _updateButtonState = (state) => {
    const { classList } = this._button;
    classList.remove('loading');
    classList.remove('active');
    if (state) classList.add(state);
  };
  _flyToCurrentLocation = () => {
    const map = this._map;
    const { _currentLocation: center } = this;
    const { offset: _offset } = this.options;
    const offset = typeof _offset === 'function' ? _offset() : _offset;
    const { x, y } = map.project(center);
    const { offsetWidth, offsetHeight, offsetLeft, offsetTop } =
      map.getContainer();
    const margin = Math.max(offsetWidth, offsetHeight);
    const withinBounds =
      x > offsetLeft - margin &&
      x < offsetWidth + margin &&
      y > offsetTop - margin &&
      y < offsetHeight + margin;
    // console.log(center, x, y, offsetLeft, offsetTop, offsetWidth, offsetHeight);
    const eventData = {
      geolocateSource: true,
    };
    if (withinBounds) {
      if (map.getZoom() < 14) {
        map.easeTo(
          {
            center,
            zoom: 18,
            duration: 300,
            offset,
            animate: false,
          },
          eventData,
        );
      } else {
        map.flyTo(
          {
            center,
            zoom: 18,
            speed: 1.5,
            duration: 2000,
            offset,
          },
          eventData,
        );
      }
    } else {
      map.easeTo(
        {
          center,
          zoom: 18,
          duration: 300,
          offset,
          animate: false,
        },
        eventData,
      );
    }
  };
  _setHeading = (e) => {
    if (!this._watching) return;
    if (!e) return;
    const heading =
      e.webkitCompassHeading ??
      (e.alpha !== null ? compassHeading(e.alpha, e.beta, e.gamma) : null);
    if (heading === null) return;
    this._heading = heading;
    this._updateCompass();
  };
  _updateCompass = () => {
    if (this._heading === null) return;
    this._compass.hidden = false;
    const rotation = Math.round(this._heading - this._map.getBearing());
    this._compass.style.transform = `rotate(${rotation}deg)`;
  };
  // iOS only sends compass readings once Motion & Orientation access is
  // allowed, and only prompts for it during a tap. Tracking starts on load
  // without a tap when location is already allowed, so keep asking on each
  // button tap until access is granted.
  _requestOrientationPermission = () => {
    if (
      this._orientationGranted ||
      !window.DeviceOrientationEvent ||
      typeof DeviceOrientationEvent.requestPermission !== 'function'
    ) {
      return Promise.resolve();
    }
    return DeviceOrientationEvent.requestPermission()
      .then((permissionState) => {
        this._orientationGranted = permissionState === 'granted';
      })
      .catch((e) => {
        console.warn('DeviceOrientation permission error:', e);
      });
  };
  _clickButton = (e, locking = true) => {
    if (e) e.preventDefault();
    if (!this._setup) return;
    const { onClick } = this.options;

    // Must run synchronously within the tap for iOS to show its prompt
    const orientationPermission = this._requestOrientationPermission();

    if (this._watching) {
      this._updateButtonState('active');
      this._flyToCurrentLocation();
      this._locking = true;
      onClick(this._currentLocation);
    } else if (this._watchId !== null) {
      // Still waiting for the first fix; it'll be shown when it arrives
      this._updateButtonState('loading');
      this._locking = this._locking || locking;
    } else {
      this._updateButtonState('loading');
      this._buttonClicked = true;
      this._locking = locking;
      const userInitiated = !!e;

      const startWatching = () => {
        // A second tap can land while the orientation prompt is open
        if (this._watchId !== null) return;
        this._watchId = navigator.geolocation.watchPosition(
          (position) => {
            console.log({ position });
            const { latitude, longitude } = position.coords;

            if (`${[latitude, longitude]}` === `${this._currentLocation}`)
              return; // No idea why

            // console.log({ latitude, longitude });
            this._currentLocation = [longitude, latitude];
            this._dot.setLngLat(this._currentLocation);

            if (!this._dot._addedToMap) {
              this._dot.addTo(this._map);
              this._dot._addedToMap = true;
            }

            if (this._locking) {
              this._updateButtonState('active');
              this._flyToCurrentLocation();
            } else {
              this._updateButtonState(null);
            }

            if (this._buttonClicked) {
              // Differentiate between initiated from button click or watchPosition subsequent runs
              this._buttonClicked = false;
              onClick(this._currentLocation);
            }
            this._watching = true;
          },
          (e) => {
            console.warn(e);
            this._buttonClicked = false;
            if (!this._watching) {
              // Don't fly to a first fix that turns up long after the tap
              this._locking = false;
              this._updateButtonState(null);
            }

            // Timeouts and lost signal are temporary and the watch keeps
            // running, so only give up when access is refused
            if (e.code !== e.PERMISSION_DENIED) return;
            navigator.geolocation.clearWatch(this._watchId);
            this._watchId = null;
            this._watching = false;
            this._locking = false;
            this._updateButtonState(null);
            if (this._deviceorientation) {
              window.removeEventListener(
                this._deviceorientation,
                this._setHeading,
              );
              this._deviceorientation = null;
            }
            // Only explain when asked, not when tracking started by itself
            if (userInitiated) {
              alert(
                'Looks like location tracking is blocked on your browser. Please enable it in the settings to use this feature.',
              );
            }
          },
          {
            enableHighAccuracy: true,
            timeout: 60 * 1000, // 1min
            maximumAge: 1000, // 1s
          },
        );
      };

      if (window.DeviceOrientationEvent && !this._deviceorientation) {
        // https://developers.google.com/web/updates/2016/03/device-orientation-changes
        // https://stackoverflow.com/a/47870694/20838
        // iOS Safari supports webkitCompassHeading via 'deviceorientation' only.
        // 'deviceorientationabsolute' may appear in window but never fire on
        // iOS or localhost Chrome, so only use it on non-Apple browsers.
        const isApple = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent);
        if (location.hostname === 'localhost' || isApple) {
          this._deviceorientation = 'deviceorientation';
        } else {
          this._deviceorientation =
            'ondeviceorientationabsolute' in window
              ? 'deviceorientationabsolute'
              : 'deviceorientation';
        }
        window.addEventListener(
          this._deviceorientation,
          this._setHeading,
          false,
        );
      }

      // Start geolocation only after the orientation prompt (if any) is
      // answered, so the two iOS prompts don't compete
      orientationPermission.finally(startWatching);
    }
  };
}
