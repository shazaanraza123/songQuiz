require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const querystring = require('querystring');

const app = express();
app.use(cors());

const client_id = process.env.SPOTIFY_CLIENT_ID;
const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
const redirect_uri = process.env.SPOTIFY_REDIRECT_URI;

console.log('client_id:', client_id);
console.log('client_secret:', client_secret);
console.log('redirect_uri:', redirect_uri);

app.get('/login', (req, res) => {
  const scope = 'streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state playlist-read-private';
  const auth_query = querystring.stringify({
    response_type: 'code',
    client_id,
    scope,
    redirect_uri,
  });
  res.redirect('https://accounts.spotify.com/authorize?' + auth_query);
});

app.get('/callback', async (req, res) => {
  const code = req.query.code || null;
  try {
    const response = await axios.post('https://accounts.spotify.com/api/token', querystring.stringify({
      code,
      redirect_uri,
      grant_type: 'authorization_code'
    }), {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(client_id + ':' + client_secret).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    // Send the access token to the frontend (you can use a redirect with a query param, or set a cookie)
    res.redirect('http://127.0.0.1:8000/?access_token=' + response.data.access_token);
  } catch (err) {
    res.send('Error getting tokens: ' + err);
  }
});

app.listen(8888, () => {
  console.log('Backend server running on http://127.0.0.1:8888');
});
