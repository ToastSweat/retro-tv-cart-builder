/* Deliberately invented editorial and technical values; never a live catalog. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RetroLibraryDemo = {data: factory()};
}(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const categories = ['Episode/Show', 'Commercial', 'Branding', 'Other'];
  const subtypes = ['IDENT','PROMO','INTRO','BUMPER_IN','BUMPER_OUT','BUMPER_GENERIC','TRANSITION','NEXT','SIGN_OFF','MUSIC_VIDEO','OTHER'];
  const health = ['READY','UNREVIEWED','EXCLUDED','BAD_QUALITY','BAD_AUDIO','NEEDS_CLIPPED','NEEDS_CROP','DUPLICATE','MAYBE'];
  const networks = ['NICK','SNICK','CN','Unassigned'];
  function seed() {
    const rows = [
      ['ad','AD-004 Snapple (sample)','Commercial','OTHER','Unassigned','UNREVIEWED','Snoop Dogg, moon, soft drink'],
      ['part-1','Demo Orbit — part 1','Episode/Show','OTHER','CN','READY','Illustrative first episode part'],
      ['part-2','Demo Orbit — part 2','Episode/Show','OTHER','CN','READY','Illustrative second episode part'],
      ['ident','Demo CN generic ident','Branding','IDENT','CN','READY','Generic identity; not a series announcement'],
      ['next','Demo NEXT — Demo Garden','Branding','NEXT','CN','UNREVIEWED','Manually associated with Demo Garden only'],
      ['missing','Demo missing source','Commercial','OTHER','NICK','READY','Formerly ready; missing file does not erase raw health'],
      ['audio','Demo audio repair','Commercial','OTHER','SNICK','BAD_AUDIO','Hiss noted by illustrative reviewer'],
      ['duplicate','Demo archive duplicate','Other','OTHER','Unassigned','DUPLICATE','ARCHIVE_MISC legacy illustration'],
      ['excluded','Demo excluded fragment','Other','OTHER','NICK','EXCLUDED','Retained for reference and history'],
      ['maybe','Demo uncertain legacy clip','Branding','PROMO','SNICK','MAYBE','Legacy MAYBE is preserved; no inferred approval']
    ];
    return rows.map((r, i) => ({
      id: 'demo-' + r[0], name: r[1], category: r[2], subtype: r[3], network: r[4], health: r[5], notes: r[6],
      reason: r[5] === 'BAD_AUDIO' ? 'Illustrative hiss / distortion' : r[5] === 'READY' ? 'Illustrative prior manual review' : 'Illustrative review pending / retained reason',
      path: 'D:/Example media/' + r[0] + '.mp4', locationId: 'demo-location-1', missing: r[0] === 'missing',
      family: ['part-1','part-2'].includes(r[0]) ? 'demo-family-orbit' : r[0] === 'duplicate' ? 'demo-family-audio' : 'demo-family-' + r[0],
      sourceId: r[0] === 'duplicate' ? 'demo-audio' : '', variantOf: r[0] === 'duplicate' ? 'demo-audio' : '', show: ['part-1','part-2'].includes(r[0]) ? 'Demo Orbit' : r[0] === 'next' ? 'Demo Garden' : '',
      pool: r[2] === 'Branding' ? 'Demo branding pool' : 'Demo general pool',
      date: i === 0 ? {mode: 'Unknown', value: ''} : {mode: 'Year', value: '1997'},
      availableFrom: '', availableTo: '',
      technical: {duration: i < 3 ? 120 : 30, dimensions: '720 × 480', codec: 'H.264', sar: '8:9'},
      recipe: {trimStart: 0, trimEnd: 0, crop: {left: 0, right: 0, top: 0, bottom: 0}, audio: r[0] === 'audio' ? 'RESTORE' : 'NONE', revision: 1},
      uses: ['part-1','ident','missing'].includes(r[0]) ? [{cart: 'Demo Cart A', state: 'Built / reviewed', recipe: 1}, {cart: 'Demo Cart B', state: 'Reserved', recipe: 1}] : [],
      legacyType: r[2] === 'Episode/Show' ? 'EPISODE' : r[2] === 'Commercial' ? 'COMMERCIAL' : r[2] === 'Branding' ? 'BRANDING' : 'ARCHIVE_MISC',
      legacySubtype: r[2] === 'Episode/Show' ? 'Demo Orbit (legacy series in Subtype)' : r[3]
    }));
  }
  return {seed, categories, subtypes, health, networks, scenarios: ['Populated','Empty','Missing source','Busy','Error']};
}));
