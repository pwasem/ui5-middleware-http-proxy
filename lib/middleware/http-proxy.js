const log = require('@ui5/logger').getLogger('ui5-middleware-http-proxy')
const request = require('request')
const dotenv = require('dotenv')

// load .env
dotenv.config()

const _setAuthEnvironment = auth => {
  const { HTTP_PROXY_AUTH_USER, HTTP_PROXY_AUTH_PASS } = process.env
  if (!auth.user) {
    auth.user = HTTP_PROXY_AUTH_USER
  }
  if (!auth.pass) {
    auth.pass = HTTP_PROXY_AUTH_PASS
  }
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
  const { debug = false, baseUrl, path = '/', secure = true, auth = {} } = configuration

  // try to set auth from .env
  _setAuthEnvironment(auth)

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
