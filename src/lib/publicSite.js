// Explicit public domains only. API routes, historical records and mailboxes
// are not selected from this display/SEO helper.
const canonicalHosts=new Map([
  ['recurretumulta.eu','www.recurretumulta.eu'],['www.recurretumulta.eu','www.recurretumulta.eu'],
  ['resuelvetusmovidas.es','www.resuelvetusmovidas.es'],['www.resuelvetusmovidas.es','www.resuelvetusmovidas.es'],
]);
export function publicOrigin(host=globalThis.location?.hostname){return 'https://'+(canonicalHosts.get(host)||'www.recurretumulta.eu');}
export function publicUrl(value,host){
  const url=new URL(value,publicOrigin(host));
  return canonicalHosts.has(url.hostname)?publicOrigin(host)+url.pathname+url.search+url.hash:value;
}
