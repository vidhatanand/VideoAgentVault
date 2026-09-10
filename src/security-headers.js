/** The player document, not just media requests, must restrict iframe parents. */
import {origins} from './util.js';
export function playerCsp(allowed=[]) {
  const parents=origins(allowed);
  return `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self'; worker-src 'self' blob:; frame-src 'self'; frame-ancestors 'self'${parents.length?' '+parents.join(' '):''}; base-uri 'none'; object-src 'none'; form-action 'self'`;
}

/** Library embeds the same HLS player but cannot itself be embedded. */
export function workspaceCsp(){return playerCsp().replace("frame-ancestors 'self'", "frame-ancestors 'none'");}
