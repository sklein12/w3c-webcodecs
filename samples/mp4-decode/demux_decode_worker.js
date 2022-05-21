importScripts("./mp4box.all.min.js");
importScripts("./mp4_demuxer.js");
importScripts("./encode-worker.js");

const encodeWorker = new Worker("./encode-worker.js");
let stopDecoding = false;
self.addEventListener("message", function (e) {
  if (e.data.stop) {
    endoceWorker.postMessage({
      type: "stop",
    });
  }
  let offscreen = e.data.canvas;
  let fileHandle = e.data.fileHandle;
  let ctx = offscreen.getContext("2d");
  let startTime = 0;
  let frameCount = 0;

  let demuxer = new MP4Demuxer("COD.mp4");

  function getFrameStats() {
    let now = performance.now();
    let fps = "";

    if (frameCount++) {
      let elapsed = now - startTime;
      console.log(
        " (" +
          ((1000.0 * frameCount) / elapsed).toFixed(0) +
          " fps) - " +
          Math.round(elapsed / 1000)
      );
    } else {
      // This is the first frame.
      startTime = now;
    }

    return "Extracted " + frameCount + " frames" + fps;
  }
  const encoder = encodeWorker.postMessage({
    type: "init",
    fileHandle,
    trackSettings: {
      width: 1280,
      height: 720,
    },
  });

  let decoder = new VideoDecoder({
    output: (frame, arg2) => {
      debugger;
      ctx.drawImage(frame, 0, 0, offscreen.width, offscreen.height);
      encodeWorker.postMessage({
        type: "encode",
        frame,
      });

      // Close ASAP.
      frame.close();

      // Draw some optional stats.
      ctx.font = "35px sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(getFrameStats(), 40, 40, offscreen.width);
    },
    error: (e) => console.error(e),
  });

  demuxer.getConfig().then((config) => {
    offscreen.height = config.codedHeight;
    offscreen.width = config.codedWidth;

    decoder.configure(config);
    demuxer.start((chunk) => {
      decoder.decode(chunk);
    });
  });
});
