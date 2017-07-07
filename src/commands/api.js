// @flow

import type {HTTPRequestOptions} from 'http-call'
import {Command, flags} from 'cli-engine-heroku'
import {inspect} from 'util'
import getStdin from 'get-stdin'

export default class API extends Command {
  static topic = 'api'
  static description = 'make a manual API request'
  static flags = {
    version: flags.string({char: 'v', description: 'version to use (e.g. 2, 3, or 3.variant)'}),
    'accept-inclusion': flags.string({char: 'a', description: 'Accept-Inclusion header to use'})
  }
  static args = [
    {name: 'method', description: 'GET, POST, PUT, PATCH, or DELETE'},
    {name: 'path', description: 'endpoint to call', optional: true}
  ]

  static help = `The api command is a convenient but low-level way to send requests
to the Heroku API. It sends an HTTP request to the Heroku API
using the given method on the given path. For methods PUT, PATCH,
and POST, it uses stdin unmodified as the request body. It prints
the response unmodified on stdout.

It is essentially like curl for the Heroku API.

Method name input will be upcased, so both 'heroku api GET /apps' and
'heroku api get /apps' are valid commands.

Examples:

    $ heroku api GET /apps/myapp
    { created_at: "2011-11-11T04:17:13-00:00",
      id: "12345678-9abc-def0-1234-456789012345",
      name: "myapp",
      …
    }

    $ export HEROKU_HEADERS
    $ HEROKU_HEADERS='
    Content-Type: application/x-www-form-urlencoded
    Accept: application/json
    '
    $ printf 'type=web&qty=2' | heroku api POST /apps/myapp/ps/scale
    2
`

  async run () {
    let request: HTTPRequestOptions = {headers: {}}
    let path = this.args.path
    request.method = (this.args.method: any)
    if (!path) {
      path = request.method
      request.method = 'GET'
    }
    request.method = request.method.toUpperCase()
    if (!path.startsWith('/')) path = `/${path}`
    let version = this.flags.version || '3'
    request.headers['accept'] = `application/vnd.heroku+json; version=${version}`
    if (this.flags['accept-inclusion']) {
      request.headers['Accept-Inclusion'] = this.flags['accept-inclusion']
    }
    if (request.method === 'PATCH' || request.method === 'PUT' || request.method === 'POST') {
      let body = await getStdin()
      if (!body) this.out.warn('no stdin provided')
      else {
        try {
          request.body = JSON.parse(body)
        } catch (e) {
          throw new Error('Request body must be valid JSON')
        }
      }
    }
    let response
    try {
      response = await this.heroku.request(path, request)
    } catch (err) {
      if (!err.statusCode) throw err
      throw new Error(`HTTP: ${err.statusCode} ${path}\n${inspect(err.body)}`)
    }

    if (typeof response.body === 'object') {
      this.out.styledJSON(response.body)
    } else {
      this.out.log(response.body)
    }
  }
}