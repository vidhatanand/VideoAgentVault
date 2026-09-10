/** The player document, not just media requests, must restrict iframe parents. */
import {origins} from './util.js';
export function playerCsp(allowed=[],{live=false}={}) {
  const parents=origins(allowed);
  return `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:${live?' https://*.cloudflarestream.com':''}; connect-src 'self'${live?' https://*.cloudflarestream.com':''}; worker-src 'self' blob:; frame-src 'self'${live?' https://*.cloudflarestream.com':''}; frame-ancestors 'self'${parents.length?' '+parents.join(' '):''}; base-uri 'none'; object-src 'none'; form-action 'self'`;
}
