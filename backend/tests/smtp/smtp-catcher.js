// Minimal localhost SMTP catcher. Speaks plaintext AUTH PLAIN and does not
// advertise STARTTLS, so Nodemailer can deliver without an external server.
const net = require('node:net');

function startSmtpCatcher() {
  const messages = [];
  const sockets = new Set();

  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.setEncoding('utf8');
    socket.on('close', () => sockets.delete(socket));

    let buffer = '';
    let mode = 'command';
    let data = '';
    let mailFrom = '';
    let recipients = [];

    const reply = (line) => socket.write(`${line}\r\n`);
    socket.write('220 localhost ESMTP\r\n');

    socket.on('data', (chunk) => {
      buffer += chunk;
      while (buffer.length > 0) {
        const breakAt = buffer.indexOf('\n');
        if (breakAt === -1) return;
        let line = buffer.slice(0, breakAt);
        buffer = buffer.slice(breakAt + 1);
        if (line.endsWith('\r')) line = line.slice(0, -1);

        if (mode === 'data') {
          if (line === '.') {
            messages.push({
              raw: data,
              mailFrom,
              recipients: recipients.slice(),
            });
            data = '';
            mailFrom = '';
            recipients = [];
            mode = 'command';
            reply('250 queued');
          } else {
            data += `${line.startsWith('..') ? line.slice(1) : line}\n`;
          }
          continue;
        }

        const command = line.toUpperCase();
        if (command.startsWith('EHLO') || command.startsWith('HELO')) {
          socket.write('250-localhost\r\n250 AUTH PLAIN\r\n');
        } else if (command.startsWith('AUTH PLAIN')) {
          reply('235 authenticated');
        } else if (command.startsWith('MAIL FROM:')) {
          mailFrom = line.slice('MAIL FROM:'.length).trim();
          reply('250 ok');
        } else if (command.startsWith('RCPT TO:')) {
          recipients.push(line.slice('RCPT TO:'.length).trim());
          reply('250 ok');
        } else if (command === 'DATA') {
          mode = 'data';
          reply('354 end with <CRLF>.<CRLF>');
        } else if (command === 'RSET') {
          data = '';
          mailFrom = '';
          recipients = [];
          reply('250 ok');
        } else if (command === 'NOOP' || command.startsWith('VRFY')) {
          reply('250 ok');
        } else if (command === 'QUIT') {
          reply('221 bye');
          socket.end();
        } else {
          reply('250 ok');
        }
      }
    });
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        port,
        messages,
        close() {
          for (const socket of sockets) socket.destroy();
          return new Promise((done) => server.close(() => done()));
        },
      });
    });
  });
}

module.exports = { startSmtpCatcher };
