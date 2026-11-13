var WebSocket = require('ws')
var express = require('express')
var app = express()
var expressWs = require('express-ws')(app)

app.use(express.static('static'))

app.ws('/', function(client) {
  client.on('message', function(message, isBinary) {
    if (isBinary) {
      client.close(1003, 'Send control data as JSON text')
      return
    }

    var controls
    try {
      controls = JSON.parse(message.toString())
    } catch (error) {
      console.error('Invalid WebSocket control message:', error.message)
      client.close(1007, 'Invalid JSON')
      return
    }

    var controlFields = ['roll', 'pitch', 'yaw', 'throttle', 'leftSwitch', 'gear']
    var isValidControls = controls && typeof controls === 'object' &&
      !Array.isArray(controls) &&
      controlFields.every(function(field) {
        return typeof controls[field] === 'number' &&
          Number.isFinite(controls[field]) &&
          controls[field] >= -128 && controls[field] <= 255
      })

    if (!isValidControls) {
      console.error('Invalid WebSocket control message: expected numeric control fields')
      client.close(1008, 'Expected numeric control fields')
      return
    }

    expressWs.getWss('/').clients.forEach(function(peer) {
      if (peer !== client && peer.readyState === WebSocket.OPEN) {
        peer.send(JSON.stringify(controls))
      }
    })
  })
})

app.get('/', function(req, res) {
  res.sendFile(__dirname + '/index.html')
})

//app.listen(8080)
const port = process.env.PORT || 8080; // 클라우드 포트  사용가능
app.listen(port, function() {
  console.log(`The server has started on port ${port}.`);
});