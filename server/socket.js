// Holds the Socket.IO server instance so REST routes can broadcast realtime events
let ioInstance = null;

const setIo = (io) => { ioInstance = io; };
const getIo = () => ioInstance;

// Broadcast a persisted chat message through the existing realtime channels
const broadcastChatMessage = (message) => {
  if (!ioInstance) return;
  if (message.recipient_id) {
    ioInstance.emit(`dm_${message.sender_id}_${message.recipient_id}`, message);
    ioInstance.emit(`dm_${message.recipient_id}_${message.sender_id}`, message);
  } else {
    ioInstance.to(message.room_id).emit('receive_chat_message', message);
  }
};

module.exports = { setIo, getIo, broadcastChatMessage };
