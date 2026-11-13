// Explicit public domains only. API routes, historical records and mailboxes
// are not selected from this display/SEO helper.
const canonicalHosts=new Map([
  ['recurretumulta.eu','www.resuelvetusmovidas.es'],['www.recurretumulta.eu','www.resuelvetusmovidas.es'],
  ['resuelvetusmovidas.es','www.resuelvetusmovidas.es'],['www.resuelvetusmovidas.es','www.resuelvetusmovidas.es'],
]);
export function publicOrigin(host=globalThis.location?.hostname){return 'https://'+(canonicalHosts.get(host)||'www.resuelvetusmovidas.es');}
export function publicUrl(value,host){
  const url=new URL(value,publicOrigin(host));
  return canonicalHosts.has(url.hostname)?publicOrigin(host)+url.pathname+url.search+url.hash:value;
}
