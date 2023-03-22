const ICAL = require('ical.js')
// docs: https://kewisch.github.io/ical.js/api/ICAL.html


const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

function get_cal_wrapper (iCalendarDataText) {
  const jcalData = ICAL.parse(iCalendarDataText)
  const vcalendar = new ICAL.Component(jcalData)
  vcalendar.removeAllSubcomponents('vevent')
  const cal_wrapper_text = vcalendar.toString()
  return cal_wrapper_text
}

const wanted_event_properties = `
    uid
    dtstart
    dtend
    summary
    description
    location
    last-modified
    x-google-conference
  `
  .split(/\s+/g)
  .filter(Boolean)
  .sort()

function get_event_properties(event) {
  let properties = event.component.getAllProperties()

  properties = properties
    .filter(p => wanted_event_properties.includes(p.name))
    .reduce((acc, p) => {
      const type = p.getDefaultType()
      const first_value = p.getFirstValue()
      let value = null

      switch (type) {
        case 'date-time':
          value = first_value.toJSDate().toISOString() // toICALString toJSDate toUnixTime
          break
        default:
          value = first_value.toString()
      }

      if (!acc[p.name]) {
        acc[p.name] = {
          type,
          value: null,
        }
      }

      if (acc[p.name].value === null) {
        acc[p.name].value = value
      } else {
        if (Array.isArray(acc[p.name].value)) {
          acc[p.name].value.push(value)
        } else {
          acc[p.name].value = [acc[p.name].value, value]
        }
      }

      return acc
    }, {})
  
  return {
    type: 'event',
    properties,
    // vevent: String(event.toString()),
  }
}

function get_cal_events (iCalendarDataText, options = {}) {

  const {
    wanted_range_start = null,
    wanted_range_end = null,
    with_property_types = false,
  } = options // start and end are dates

  const jcalData = ICAL.parse(iCalendarDataText)
  const vcalendar = new ICAL.Component(jcalData)
  const events = vcalendar.getAllSubcomponents('vevent')


  const found_events = []

  for (var i = 0; i < events.length; i++) {
    const event = new ICAL.Event(events[i]);

    const iterator = event.iterator() // todo can we pass a start and end date to the iterator? Maybe with ICAL.Time.now(); ?

    let next;
    let num = 0;
    const max_iterations = 10 // IMPORTANT to prevent infinite loop
    while ((next = iterator.next()) && num++ < max_iterations) {
      const ocs = event.getOccurrenceDetails(next)

      const startDate = ocs.startDate.toJSDate()
      const endDate = ocs.endDate.toJSDate()
      if (wanted_range_start !== null && startDate < wanted_range_start && endDate < wanted_range_start) {
        // event is before wanted_range_start
        continue // skip event till we are after wanted_range_start
      }
      if (wanted_range_end !== null && startDate > wanted_range_end && endDate > wanted_range_end) {
        // event is after wanted_range_end
        break // no more events as we are after wanted_range_end
      }

      let event_properties = get_event_properties(ocs.item)
      event_properties.properties.dtstart = { type: 'date-time', value: startDate.toISOString() }
      event_properties.properties.dtend = { type: 'date-time', value: endDate.toISOString() }

      if (with_property_types === false) {
        event_properties.properties = Object.keys(event_properties.properties).reduce((acc, key) => {
          acc[key] = event_properties.properties[key].value
          return acc
        }, {})
      }

      found_events.push(event_properties)
    }
  }

  return found_events
}




function x_apple_fix(iCalendarDataText) {
  /*
  This fixes miss whitespace in the X-TITLE property
  Example:
  X-APPLE-STRUCTURED-LOCATION;VALUE=URI;X-ADDRESS=Am Propsthof 134\\n53121 
   Bonn\\nGermany;X-APPLE-ABUID="JaP’s Home"::;X-APPLE-RADIUS=0;X-APPLE-REF
   ERENCEFRAME=1;X-TITLE=Am Propsthof 134
  53121 Bonn
  Germany:geo:50.731208,7.064618
  */

  iCalendarDataText = iCalendarDataText.replace(/=([^:=]*?):geo:/ig, function(match, group1) {
    const new_group1 = group1.replace(/\n([^\s])/g, '\n $1')
    match = match.replace(group1, new_group1)
    return match
  })

  return iCalendarDataText
}

function parse_volt_links(description) {
  const links_regex = /###LINKS###({.*})/;

  let properties = {}

  const links_match = description.match(links_regex)
  if (links_match) {
    try {
      let links_json = (links_match[1] || '')
        .replaceAll('"', '\\"')
        .replaceAll('{\\"', '{"')
        .replaceAll('\\"}', '"}')
        .replaceAll('\\":', '":')
        .replaceAll(':\\"', ':"')
        .replaceAll('\\",', '",')
        .replaceAll(',\\"', ',"')

      properties = JSON.parse(links_json)

      const a_tag_regex = /<a.*?href="(.*?)".*?>(.*?)<\/a>/gi

      for (const key in properties) {
        if (properties.hasOwnProperty(key)) {
          const value = properties[key];
          if (value.match(a_tag_regex)) {
            properties[key] = value.replace(a_tag_regex, '$1')
          }
        }
      }
    } catch (error) {
      properties = {
        error: 'Could not parse links',
        error_details: String(error),
      }
      console.error('Could not parse links', error)
    }

    description = description.replace(links_regex, '')
  }

  return {
    ...properties,
    description,
  }
}

async function get_events_from_calendar_url(options) {
  const {
    ical_url = 'https://calendars.icloud.com/holidays/de_de.ics/',
    wanted_range_start = '2023-01-01', // needs to be an ISO date string
    wanted_range_end = '2023-02-01', // needs to be an ISO date string
  } = options || {}

  const response = await fetch(ical_url)

  let iCalendarDataText = await response.text() // read response body as text
  iCalendarDataText = x_apple_fix(iCalendarDataText)

  let events = get_cal_events(iCalendarDataText, {
    wanted_range_start: new Date(wanted_range_start),
    wanted_range_end: new Date(wanted_range_end),
  })

  events = events.map(event => ({
    type: event.type,
    ...event.properties,
    ...parse_volt_links(event.properties.description),
    source: ical_url,
  }))

  return events
}

/*

get_events_from_calendar_url()
  .then(events => {
    console.log('events', events)
    console.log('done')
  })
  .catch(error => {
    console.log('error', error)
  })

*/

module.exports = {
  get_events_from_calendar_url,
}
