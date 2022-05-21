importScripts("./webm-writer2.js");

let webmWriter = null;
let fileWritableStream = null;
let frameReader = null;
let encoder = null;

async function stopRecording() {
  await frameReader.cancel();
  await webmWriter.complete();
  fileWritableStream.close();
  frameReader = null;
  webmWriter = null;
  fileWritableStream = null;
}

self.addEventListener("message", function (e) {
  switch (e.data.type) {
    case "init":
      initEncoder(e.data.fileHandle, e.data.trackSettings);
      break;
    case "encode":
      encode(e.data.frame, false);
      break;
    case "stop":
      done();
  }
});

async function encode(frame, done) {
  if (encoder.encodeQueueSize <= 30) {
    if (++this.frameCounter % 20 == 0) {
      console.log(this.frameCounter + " frames processed");
    }

    const insert_keyframe = this.frameCounter % 150 == 0;
    encoder.encode(frame, { keyFrame: insert_keyframe });
  } else {
    console.log("dropping frame, encoder falling behind");
  }

  frame.close();
  console.log(this.frameCounter);
  if (this.frameCounter === 600) {
    console.log("closing");
    await encoder.flush();
    encoder.close();
    await webmWriter.complete();
    await fileWritableStream.close();
    return;
  }
}

async function done() {
  await encoder.flush();
  encoder.close();
  await fileWritableStream.close();
  return;
}

async function initEncoder(fileHandle, trackSettings) {
  this.frameCounter = 0;
  fileWritableStream = await fileHandle.createWritable();

  webmWriter = new WebMWriter({
    fileWriter: fileWritableStream,
    codec: "VP8",
    width: trackSettings.width,
    height: trackSettings.height,
  });

  const init = {
    output: (chunk) => {
      webmWriter.addFrame(chunk);
    },
    error: (e) => {
      console.log(e.message);
      stopRecording();
    },
  };

  const config = {
    codec: "vp8",
    width: trackSettings.width,
    height: trackSettings.height,
    // bitrate: 10e6,
    framerate: 60,
    bitrateMode: "constant",
  };

  encoder = new VideoEncoder(init);
  let support = await VideoEncoder.isConfigSupported(config);
  console.assert(support.supported);
  encoder.configure(config);
}
