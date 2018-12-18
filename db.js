const mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose');

const InsertedFileA = new mongoose.Schema({
  _id: {type: String, required: true},
  length: {type: String, required: true},
  uploadDate: {type: Date, required: true},
  filename: {type: String, required: true},
  md5: {type: String, required: true},
  contentType: {type: String, required: true}
}, {
  _id: true
});

// Same as above except this is a file provided by user
const InsertedFileV = new mongoose.Schema({
  _id: {type: String, required: true},
  length: {type: String, required: true},
  uploadDate: {type: Date, required: true},
  filename: {type: String, required: true},
  md5: {type: String, required: true},
  contentType: {type: String, required: true}
}, {
  _id: true
});

const User = new mongoose.Schema({
  // username provided by authentication plugin
  // password hash provided by authentication plugin
  InsertedListA: [InsertedFileA],
  InsertedListV: [InsertedFileV]
});

User.plugin(passportLocalMongoose);

mongoose.model("User", User);
mongoose.model("InsertedFileA", InsertedFileA);
mongoose.model("InsertedFileV", InsertedFileV);

mongoose.connect("mongodb://localhost/bootstraplearn");

/*const InsertedFileCons = mongoose.model('InsertedFile');
const ifc = new InsertedFileCons({
name: 'name',
filepath: 'filepath',
createdAt: '2018-11-19',
delete: false
});
ifc.save((err, res) => {console.log(err, res)});
*/


