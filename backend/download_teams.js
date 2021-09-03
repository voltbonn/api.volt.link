const fetch = require('node-fetch')
const fs = require('fs')

require('dotenv').config({
  path: '../.env'
})

const url = 'https://volt.team/api/v1/teams'
const url_infos = 'https://volt.team/volt-city-teams.json'
const url_infos_vcp = 'https://www.voltdeutschland.org/_api/cities'
const volt_team_api_key = process.env.volt_team_api_key
const volt_team_cookie = process.env.volt_team_cookie
const path_vl_cache = './cache/paths.json'
const path_teams = './cache/teams.json'
const path_simple_teams = '../cache/simple_teams.json'

// fetch volt.team teams with api key as bearer
const options = {
  method: 'GET',
  headers: {
    'Accept': 'application/json',
    'Authorization': `Bearer ${volt_team_api_key}`,
    'Cache-Control': 'no-cache',
    'Cookie': volt_team_cookie,
  }
}

async function fetchTeams () {
  try {
    const response = await fetch(url, options)
    const data = await response.json()
    return data
  } catch (error) {
    console.error(error)
  }
}
async function fetchTeamInfos () {
  try {
    const response = await fetch(url_infos, options)
    const data = await response.json()
    return data
  } catch (error) {
    console.error(error)
  }
}
async function fetchTeamVCPInfos () {
  try {
    const response = await fetch(url_infos_vcp, options)
    const data = await response.json()
    return data
  } catch (error) {
    console.error(error)
  }
}
async function readVoltLinkCache () {
  try {
    const response = fs.readFileSync(path_vl_cache)
    const data = JSON.parse(response)
    return data
  } catch (error) {
    console.error(error)
  }
}

async function downloadTeamsToCache () {
  try {
    const teams_volt_link = Object.entries(
      await readVoltLinkCache()
    )
    .reduce((acc, [slug, vl_data]) => {
      if (vl_data.volt_team_id) {
        acc[vl_data.volt_team_id] = {
          volt_link_slug: slug,
          volt_link_url: `https://volt.link/${slug}`,
          // ...vl_data,
        }
      }
      return acc
    }, {})

    const team_infos = (
      await fetchTeamInfos()
    )
    .reduce((acc, team) => {
      acc[team.id] = team
      return acc
    }, {})

    const team_vcp_infos = (
      await fetchTeamVCPInfos()
    )
    .reduce((acc, team) => {
      acc[team.id] = team
      return acc
    }, {})

    const teams = (
      await fetchTeams()
    )
    .map(team => {
      const team_info = team_infos[team.id] || {}
      const team_vcp_info = team_vcp_infos[team.id] || {}
      const team_volt_link = teams_volt_link[team.id] || {}
      return {
        ...team_volt_link,
        ...team_vcp_info,
        ...team_info,
        ...team,
      }
    })

    const simple_teams = teams.map(team => ({
      id: team.id,
      name: team.name,
    }))

    fs.writeFileSync(path_teams, JSON.stringify(teams))
    fs.writeFileSync(path_simple_teams, JSON.stringify(simple_teams))
  } catch (error) {
    console.error(error)
  }
}

async function getTeams () {
  try {
    if(!fs.existsSync(path_teams)) {
      await downloadTeamsToCache()
    } else {
      const stats = fs.statSync(path_teams)
      const seconds = (new Date().getTime() - stats.mtime) / 1000
      if (seconds > 86400) { // 86400 seconds = 24 hours
        await downloadTeamsToCache()
      }
    }
    return JSON.parse(fs.readFileSync(path_teams))
  } catch (error) {
    console.error(error)
    return []
  }
}
async function getTeamsSimple () {
  try {
    if(!fs.existsSync(path_simple_teams)) {
      await downloadTeamsToCache()
    } else {
      const stats = fs.statSync(path_simple_teams)
      const seconds = (new Date().getTime() - stats.mtime) / 1000
      if (seconds > 86400) { // 86400 seconds = 24 hours
        await downloadTeamsToCache()
      }
    }
    return JSON.parse(fs.readFileSync(path_simple_teams))
  } catch (error) {
    console.error(error)
    return []
  }
}

module.exports = {
  getTeams,
  getTeamsSimple,
}
