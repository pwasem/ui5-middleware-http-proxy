const log = require('@ui5/logger').getLogger('ui5-middleware-http-proxy')
const request = require('request')
const dotenv = require('dotenv')
const lodash = require('lodash')

// load .env
dotenv.config()

const _getAuth = ({ auth = {} }) => {
  const { HTTP_PROXY_AUTH_USER, HTTP_PROXY_AUTH_PASS } = process.env
  if (!auth.user && HTTP_PROXY_AUTH_USER) {
    auth.user = HTTP_PROXY_AUTH_USER
  }
  if (!auth.pass && HTTP_PROXY_AUTH_PASS) {
    auth.pass = HTTP_PROXY_AUTH_PASS
  }
  return !lodash.isEmpty(auth) ? auth : null
}

const _resolvePath = ({ path, req }) => {
  // resolve paths
  let resolvedPath = `${path}${req.path}`
  const query = req.url.split('?')[1]
  // append query
  if (query) {
    resolvedPath += '?' + query
  }
  return resolvedPath
}

/**
 * Custom UI5 Server middleware for proxying requests
 *
 * @param {Object} parameters Parameters
 * @param {Object} parameters.resources Resource collections
 * @param {module:@ui5/fs.AbstractReader} parameters.resources.all Reader or Collection to read resources of the
 *                                        root project and its dependencies
 * @param {module:@ui5/fs.AbstractReader} parameters.resources.rootProject Reader or Collection to read resources of
 *                                        the project the server is started in
 * @param {module:@ui5/fs.AbstractReader} parameters.resources.dependencies Reader or Collection to read resources of
 *                                        the projects dependencies
 * @param {Object} parameters.options Options
 * @param {string} [parameters.options.configuration] Custom server middleware configuration if given in ui5.yaml
 * @returns {function} Middleware function to use
 */
module.exports = ({ options: { configuration = {} } }) => {
  const { debug = false, baseUrl, path = '/', secure = true } = configuration

  // get http basic auth if any
  const auth = _getAuth(configuration)

  // baseUrl is mandatory
  if (!baseUrl) {
    throw new Error('configuration.baseUrl is mandatory')
  }

  // debug log
  if (debug) {
    log.info(`Registering proxy for ${baseUrl}${path}`)
  }

  // cookie jar for subsequent requests
  const jar = request.jar()

  // middleware
  return (req, res, next) => {
    const resolvedPath = _resolvePath({ path, req })

    // debug log for each request
    if (debug) {
      log.info(`${req.method} ${req.url} -> ${baseUrl}${resolvedPath}`)
    }

    // options for proxy request
    const options = {
      baseUrl,
      uri: resolvedPath,
      auth,
      strictSSL: secure,
      jar
    }

    // pipe proxy request
    req
      .pipe(
        request(options)
          .on('error', err => {
            log.error(err.message)
            next(err)
          })
      )
      .pipe(res)
  }
}
