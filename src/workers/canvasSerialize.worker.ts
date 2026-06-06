self.onmessage = (e: MessageEvent<{ canvasObject: unknown }>) => {
  try {
    const serialized = JSON.parse(JSON.stringify(e.data.canvasObject));
    self.postMessage({ success: true, result: serialized });
  } catch (err) {
    self.postMessage({ success: false, error: String(err) });
  }
};
