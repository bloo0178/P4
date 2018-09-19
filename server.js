
require('dotenv').config();

const express = require('express')
const app = express()
const bodyParser = require('body-parser')
var moment = require('moment');
const cors = require('cors')

const mongoose = require('mongoose')
mongoose.plugin(schema => { schema.options.usePushEach = true });
mongoose.connect(process.env.MONGO_URI);

app.use(cors())

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

/*
Define Mongoose schema
*/
let Schema = mongoose.Schema;


let userSchema = new Schema({
  name: String, //SchemaType
  count: Number,
  log: [{ description: String, duration: Number, date: String }],
})

let User = mongoose.model('User', userSchema);

/*
Create a new user app.post(/api/exercise/new-user) - show json w/ ID)
User should have a log that is an array of exercises
*/
app.post('/api/exercise/new-user', function (req, res) {
  let username = req.body.username;
  User.findOne({ name: username }, (err, results) => {
    if (err) {
      res.send(err);
    } else if (results != null) {
      res.send("Username already taken.");
    } else {
      let newUser = ({ name: username, count: 0, log: [] });
      User.create(newUser, (err, user) => {
        if (err) {
          res.send(err);
        } else {
          res.json({ username: user.name, id: user._id });
        }
      })
    }
  })
});

/*
Add exercises app.post(/api/exercise/add)
*/
app.post('/api/exercise/add', (req, res) => {
  let userId = req.body.userId;
  let description = req.body.description;
  let duration = req.body.duration;
  User.findById(userId, (err, user) => {
    if (err) {
      res.send(err);
    } else {
      let date = req.body.date;
      user.count = user.count + 1;
      let newEntry = { description: description, duration: duration, date: date };
      user.log.push(newEntry);
      user.save((err, user) => {
        if (err) {
          res.send(err);
        } else {
          res.json({ username: user.username, _id: user._id, description: description, duration: duration, date: date });
        }
      })
    }
  })
});

/*
Get user's exercise log
GET /api/exercise/log?{userId=1234}[&from][&to][&limit]
dates (yyyy-mm-dd); limit = number
*/
app.get('/api/exercise/log', (req, res) => {
  let userId = req.query.userId;
  let from = req.query.from;
  let to = req.query.to;
  let limit = req.query.limit;

  let limitOptions = {};
  if (limit) limitOptions.limit = limit;
  User.findById(userId)
    .populate({ path: 'log', match: {}, select: '-_id', options: limitOptions })
    .exec((err, user) => {
      if (err) {
        res.send(err);
      }
      let response = { id: user._id, username: user.name, count: user.count };
      if (from) response.from = from;
      if (to) response.to = to;
      response.log = user.log.filter((data) => {
        if (from && to) {
          return new Date(data.date) >= new Date(from) && new Date(data.date) <= new Date(to);
        } else if (from) {
          return new Date(data.date) >= new Date(from);
        } else if (to) {
          return new Date(data.date) <= new Date(to);
        }
        else {
          return true;
        }
      });
      response.log.map((entry) => {
        entry.date = moment(new Date(entry.date)).format('dddd, YYYY-MM-DD');
      })
      res.json(response);
    })
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})

/*
Lessons Learned:

-MongoDB needs to utilize its default _id to perform functions such as .populate('path'). 
Using a module such as short-id to populate the default field of _id prevents this method
from executing successfully, returning an error along the lines of "Cast to String" failed,
or "Cast to ObjectID" failed.

-When validating if a name is already taken, use findOne or findById. These return a single 
object. Using the broader find() method with a non-standard parameter (such as name) will return 
an array that needs to be drilled into. This caused issues for me; however, this was also when 
I was using short-id - so this problem may be non-existent if short-id isn't being used.

*/