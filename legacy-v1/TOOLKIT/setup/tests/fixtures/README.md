# Synthetic STRONG regression input

`strong-regression.mp4` is generated test-pattern video and a synthetic sine tone, not an original library clip or private recording. It contains 1.6 seconds of 160×120, 30 fps H.264 with mono AAC at 44.1 kHz, encoded using the existing FFmpeg 9.0.1 libx264 ultrafast fixture pipeline.

SHA-256: `ec87144781722ccd4669f52a6a4290c95b43d483602ad9ec028d06f5c33fdb14`.

Retain these exact bytes: this fixture repeatedly triggered native memory failures in the unchanged STRONG `anlmdn` filter on the tested 9.0.1, 9.0.2 and master builds, while other medium-encoded fixtures could pass. The verified app-local maintained-8.1 backend passes all five original audio profiles. Tests copy the fixture into disposable scratch, render from that same copy, validate/decode outputs and verify source preservation.

Fixture inputs were FFmpeg `lavfi` test patterns and sine generation. There is no third-party television/audio content in this file. This provenance is a regression record, not a claim of subjective repair quality or hardware acceptance.
