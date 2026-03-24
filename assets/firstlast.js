import './error-tracking';

import { h, render, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import format from 'date-fns/format';
import _formatDuration from 'date-fns/formatDuration';

import fetchCache from './utils/fetchCache';
import { sortServices } from './utils/bus';

const dataPath = 'https://data.busrouter.sg/v1/';
const firstLastJSONPath = dataPath + 'firstlast.min.json';
const stopsJSONPath = dataPath + 'stops.min.json';

const timeStrToDate = (time) => {
  if (time instanceof Date) return time;
  if (!/\d{4}/.test(time)) return null;
  let h = +time.slice(0, 2);
  const m = +time.slice(2);
  const d = new Date();
  d.setHours(h, m);
  return d;
};

const timeFormat = (time) => {
  const date = timeStrToDate(time);
  return date ? format(date, 'p') : '-';
};

const formatDuration = (duration) => {
  const h = duration;
  const hours = Math.floor(h);
  const minutes = Math.round((h - hours) * 60);
  return _formatDuration({ hours, minutes });
};

const convertTimeToNumber = (time) => {
  const h = parseInt(time.slice(0, 2), 10);
  const m = parseInt(time.slice(2), 10);
  return h + m / 60;
};

const TimeRanger = ({ values }) => {
  const nadaEl = <div class="time-ranger nada" />;
  if (!values) return nadaEl;
  const [first, last] = values;
  if (!first || !/\d+/.test(first)) return nadaEl;
  const firstVal = convertTimeToNumber(first);
  const lastVal = convertTimeToNumber(last);
  const left = (firstVal / 24) * 100;
  const duration = (lastVal < firstVal ? lastVal + 24 : lastVal) - firstVal;
  const width = (duration / 24) * 100;
  return (
    <>
      <div class="time-ranger">
        {width + left > 100 && (
          <div
            class="bar"
            style={{
              left: 0,
              width: `${width + left - 100}%`,
            }}
          />
        )}
        <div
          class="bar"
          style={{
            left: `${left}%`,
            width: `${width}%`,
          }}
        />
      </div>
      <span class="time-duration">
        {formatDuration(duration)}
      </span>
    </>
  );
};

function FirstLastTimes() {
  const [stop, setStop] = useState(null);
  const [stopName, setStopName] = useState(null);
  const [data, setData] = useState([]);

  const [timeLeft, setTimeLeft] = useState(null);
  const [timeDate, setTimeDate] = useState(null);
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    if (!stop || !stopName) return;
    document.title = `Approximate first & last bus arrival times for ${stop}: ${stopName}`;
  }, [stop, stopName]);

  useEffect(() => {
    Promise.all([
      fetchCache(firstLastJSONPath, 24 * 60),
      fetchCache(stopsJSONPath, 24 * 60),
    ]).then(([flData, stopsData]) => {
      window.onhashchange = () => {
        const stop = location.hash.slice(1);
        const data = flData[stop];
        if (!data) {
          alert('Bus stop code not found.');
          return;
        }

        setStop(stop);
        setStopName(stopsData[stop][2]);
        setData(
          data
            .map((d) => {
              const serviceTimings = d.split(/\s+/);
              // If '=', means it's same timings as weekdays
              if (serviceTimings[3] === '=')
                serviceTimings[3] = serviceTimings[1];
              if (serviceTimings[4] === '=')
                serviceTimings[4] = serviceTimings[2];
              if (serviceTimings[5] === '=')
                serviceTimings[5] = serviceTimings[1];
              if (serviceTimings[6] === '=')
                serviceTimings[6] = serviceTimings[2];
              return serviceTimings;
            })
            .sort((a, b) => sortServices(a[0], b[0])),
        );

        const { pathname, search, hash } = location;
        gtag('config', window._GA_TRACKING_ID, {
          page_path: pathname + search + hash,
        });
      };
      window.onhashchange();
    });

    const updateTimeTick = () => {
      const date = new Date();
      setTimeDate(date);
      const val = convertTimeToNumber(format(date, 'HHmm'));
      const left = (val / 24) * 100;
      setTimeLeft(left);
    };
    updateTimeTick();
    setInterval(updateTimeTick, 60 * 1000);
  }, []);

  const formatTimeTick = (timeDate) => {
    const timeStr = timeFormat(timeDate);
    console.log({ timeDate, timeStr });
    let timeStrComp;
    if (/:/.test(timeStr)) {
      // Make sure there's ":" before making it blink
      const [a, b] = timeStr.split(':');
      timeStrComp = (
        <>
          {a}
          <blink>:</blink>
          {b}
        </>
      );
      return timeStrComp || timeStr;
    }
    return timeStr;
  };

  const isInSingapore = new Date().getTimezoneOffset() === -480;

  return (
    <div>
      <h1>
        Approximate first & last bus arrival times
        <br />
        <b>
          <span class="stop-tag">{stop || '     '}</span>{' '}
          {stopName ? stopName : <span class="placeholder">██████ ███</span>}
        </b>
      </h1>
      <p class="legend">
        <span>
          <span class="abbr">WD</span>{' '}
          Weekdays
        </span>
        <span>
          <span class="abbr">SAT</span>{' '}
          Saturdays
        </span>
        <span>
          <span class="abbr">SUN</span>{' '}
          Sunday & Public Holidays
        </span>
      </p>
      <table>
        <thead>
          <tr>
            <th>Service</th>
            <th></th>
            <th>First Bus</th>
            <th>Last Bus</th>
            <th class="timerange-header">
              <span>12 🌚</span>
              <span>6</span>
              <span>12 🌞</span>
              <span>6</span>
              {isInSingapore && !!data.length && !!timeLeft && !!timeDate && (
                <div
                  class="timerange-indicator"
                  style={{ left: `${timeLeft}%` }}
                >
                  <span>{formatTimeTick(timeDate)}*</span>
                </div>
              )}
            </th>
          </tr>
        </thead>
        {data.length
          ? data.map((d, i) => {
              const [service, ...times] = d;
              const sameAsPrevService =
                data[i - 1] && service === data[i - 1][0];
              const [wd1raw, wd2raw, sat1raw, sat2raw, sun1raw, sun2raw] =
                times;
              const [wd1, wd2, sat1, sat2, sun1, sun2] = times.map((t) =>
                timeFormat(t),
              );
              return (
                <tbody class={sameAsPrevService ? 'insignificant' : ''}>
                  <tr>
                    <td rowspan="3">{service}</td>
                    <th>
                      <abbr title="Weekdays">
                        WD
                      </abbr>
                    </th>
                    <td title={wd1raw}>{wd1}</td>
                    <td title={wd2raw}>{wd2}</td>
                    <td class="time-cell">
                      <TimeRanger values={[wd1raw, wd2raw]} />
                    </td>
                  </tr>
                  <tr>
                    <th>
                      <abbr title="Saturdays">
                        SAT
                      </abbr>
                    </th>
                    <td title={sat1raw}>{sat1}</td>
                    <td title={sat2raw}>{sat2}</td>
                    <td class="time-cell">
                      <TimeRanger values={[sat1raw, sat2raw]} />
                    </td>
                  </tr>
                  <tr>
                    <th>
                      <abbr title="Sunday & Public Holidays">
                        SUN
                      </abbr>
                    </th>
                    <td title={sun1raw}>{sun1}</td>
                    <td title={sun2raw}>{sun2}</td>
                    <td class="time-cell">
                      <TimeRanger values={[sun1raw, sun2raw]} />
                    </td>
                  </tr>
                </tbody>
              );
            })
          : [1, 2, 3].map((v) => (
              <tbody key={v}>
                <tr>
                  <td rowspan="3">
                    <span class="placeholder">██</span>
                  </td>
                  <th>
                    <abbr title="Weekdays">WD</abbr>
                  </th>
                  <td>
                    <span class="placeholder">████</span>
                  </td>
                  <td>
                    <span class="placeholder">████</span>
                  </td>
                  <td class="time-cell">
                    <TimeRanger />
                  </td>
                </tr>
                <tr>
                  <th>
                    <abbr title="Saturdays">SAT</abbr>
                  </th>
                  <td>
                    <span class="placeholder">████</span>
                  </td>
                  <td>
                    <span class="placeholder">████</span>
                  </td>
                  <td class="time-cell">
                    <TimeRanger />
                  </td>
                </tr>
                <tr>
                  <th>
                    <abbr title="Sunday & Public Holidays">SUN</abbr>
                  </th>
                  <td>
                    <span class="placeholder">████</span>
                  </td>
                  <td>
                    <span class="placeholder">████</span>
                  </td>
                  <td class="time-cell">
                    <TimeRanger />
                  </td>
                </tr>
              </tbody>
            ))}
        <tfoot>
          <tr>
            <td colspan="5">
              <p>
                {!!data.length && (
                  <>{`${data.length} ${data.length !== 1 ? 'services' : 'service'}`} · </>
                )}
                <a href="/">BusRouter SG</a>
              </p>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

const $firstlast = document.getElementById('firstlast');
render(<FirstLastTimes />, $firstlast);
