// Test yt.lemnoslife.com API responses
const testIds = ['5tWgc53xf9Y', 'URlf-04YYLk', 'jNQXAC9IVRw'];

for (const videoId of testIds) {
  try {
    const res = await fetch(`https://yt.lemnoslife.com/noKey/videos?part=player&id=${videoId}`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) { console.log(`❌ ${videoId}: HTTP ${res.status}`); continue; }
    const data = await res.json();
    const item = data.items?.[0];
    if (!item) { console.log(`❌ ${videoId}: no items`); continue; }
    const sd = item.player?.streamingData;
    const formats = [...(sd?.formats ?? []), ...(sd?.adaptiveFormats ?? [])];
    const muxed = formats.filter(f => f.mimeType?.includes('video') && !f.mimeType?.includes('vp9') && f.url);
    const anyWithUrl = formats.filter(f => f.url);
    console.log(`${videoId}: total=${formats.length} withUrl=${anyWithUrl.length} muxed=${muxed.length}`);
    if (muxed.length > 0) console.log(`  best muxed: ${muxed[0].qualityLabel} ${muxed[0].mimeType?.substring(0,30)} url=${muxed[0].url?.substring(0,60)}`);
    else if (anyWithUrl.length > 0) console.log(`  first with url: ${anyWithUrl[0].mimeType?.substring(0,30)} url=${anyWithUrl[0].url?.substring(0,60)}`);
  } catch(e) { console.log(`❌ ${videoId}: ${e.message}`); }
}
