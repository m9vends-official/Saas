let _io = null;

export const setIo = (ioInstance) => {
  _io = ioInstance;
};

export const getIo = () => {
  if (!_io) {
    console.warn("getIo() called but socket.io is not initialized yet.");
  }
  return _io;
};
