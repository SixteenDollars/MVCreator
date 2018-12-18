const express = require('express');
const passport = require('passport');
const mongoose = require('mongoose');
const session = require('express-session');
const methodOverride = require('method-override');
const path = require('path');
const bodyParser = require('body-parser');
const app = express();
const multer = require('multer');
const GridFsStorage = require('multer-gridfs-storage');
const Grid = require('gridfs-stream');
const crypto = require('crypto');
require('./db');
require('./auth');

// view engine setup
app.set('view engine', 'hbs');

// database setup
const User = mongoose.model('User');
const InsertedFileA = mongoose.model('InsertedFileA');
const InsertedFileV = mongoose.model('InsertedFileV');

// middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(methodOverride('_method'));
app.use(bodyParser.urlencoded({ extended: false }));
// enable sessions
const sessionOptions = {
    secret: 'secret cookie thang (store this elsewhere!)',
    resave: true,
    saveUninitialized: true
};
app.use(session(sessionOptions));
// start up passport
app.use(passport.initialize());
// enable persistent login sessions
app.use(passport.session());
// handlebars middleware
app.use(function (req, res, next) {
    res.locals.user = req.user;
    next();
});

// init gfs
const mongouri = "mongodb://localhost/bootstraplearn";
const conn = mongoose.createConnection(mongouri);
let gfs;
// init stream
conn.once('open', function () {
    gfs = Grid(conn.db, mongoose.mongo);
    gfs.collection('uploads');
})

// create storage engine
const storage = new GridFsStorage({
    url: mongouri,
    file: (req, file) => {
        return new Promise((resolve, reject) => {
            crypto.randomBytes(16, (err, buf) => {
                if (err) {
                    return reject(err);
                }
                const filename = buf.toString('hex') + path.extname(file.originalname);
                const fileInfo = {
                    filename: filename,
                    bucketName: 'uploads'
                };
                resolve(fileInfo);
            });
        });
    }
});
const upload = multer({ storage });

// route handlers
app.get('/', function (req, res) {
    gfs.files.find().toArray((err, files) => {
        if (!files || files.length === 0) {
            res.render('index');
        }
        else {
            const audio = ["audio/mp3", "audio/m4a", "audio/wav", "audio/flac", "audio/alac"];
            const video = ["video/mp4", "video/avi", "video/flv", "video/mov", "video/wmv"];
            let av = [];
            for (let i = 0; i < files.length; i += 2) {
                let avcomb = [];
                // guaranteed that every 2 pair of files, the video file is the first one
                files[i].video = true;
                files[i + 1].audio = true;
                avcomb.push(files[i]);
                avcomb.push(files[i + 1]);
                av.push(avcomb);
            }
            res.render('index', { files: av });
        }
    });
});

app.get('/add', function (req, res) {
    res.render('add');
});

app.post('/add', upload.fields([{ name: 'video', maxCount: 1 }, { name: 'audio', maxCount: 1 }]), function (req, res) {
    const audio = ["audio/mp3", "audio/m4a", "audio/wav", "audio/flac", "audio/alac"];
    const video = ["video/mp4", "video/avi", "video/flv", "video/mov", "video/wmv"];
    gfs.files.find().toArray((err, files) => {
        if (!files || files.length === 0) {
            res.render('index');
        }
        else {
            User.findOne({ username: req.user.username }, (err, result, count) => {
                files.map(file => {
                    if (audio.includes(file.contentType)) {
                        file.isAudio = true;
                        const newAud = new InsertedFileA({
                            _id: file._id,
                            length: file.length,
                            chunkSize: file.chunkSize,
                            uploadDate: file.uploadDate,
                            filename: file.filename,
                            md5: file.md5,
                            contentType: file.contentType
                        });
                        newAud.save(function (err, aud, count) {
                            if (err) {
                                res.render("add", { message: "Save Error" });
                            }
                        });
                        result.InsertedListA.push(newAud);
                        result.markModified('InsertedListA');
                    }


                    if (video.includes(file.contentType)) {
                        file.isVideo = true;
                        const newVid = new InsertedFileV({
                            _id: file._id,
                            length: file.length,
                            chunkSize: file.chunkSize,
                            uploadDate: file.uploadDate,
                            filename: file.filename,
                            md5: file.md5,
                            contentType: file.contentType
                        });
                        newVid.save(function (err, vid, count) {
                            if (err) {
                                res.render("add", { message: "Save Error" });
                            }
                        });
                        result.InsertedListV.push(newVid);
                        result.markModified('InsertedListV');
                    }
                });
                result.save(function (err, user, count) {
                    if (err) {
                        res.render("add", { message: "Save Error" });
                    }
                });
            });
        }
        res.render('index', { files: files });
    });
});

app.get('/files/:filename', function (req, res) {
    gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
        if (!file || file.length === 0) {
            return res.status(404).json({
                err: 'No file exist'
            });
        }
        var readstream = gfs.createReadStream(file.filename);
        readstream.pipe(res);
    });
});

app.get('/files/dlall', function (req, res) {
    gfs.files.find().toArray((err, files) => {
        if (!files || files.length === 0) {
            res.render('index');
        }
        else {
            files.forEach(function (file) {
                var readstream = gfs.createReadStream(file.filename);
                readstream.pipe(res);
            });
            res.render('files', { files: files });
        }
    });
});

app.get('/files', function (req, res) {
    gfs.files.find().toArray((err, files) => {
        if (!files || files.length === 0) {
            res.render('files', { message: "No added files!" });
        }
        else {
            if (req.query.filter !== undefined) {
                const audio = ["audio/mp3", "audio/m4a", "audio/wav", "audio/flac", "audio/alac"];
                const video = ["video/mp4", "video/avi", "video/flv", "video/mov", "video/wmv"];
                let filtered = [];
                if (req.query.filter === "filter=videofilt") {
                    filtered = files.filter(file => video.includes(file.contentType));
                }
                else {
                    filtered = files.filter(file => audio.includes(file.contentType));
                }
                res.render('files', { files: filtered });
            }
            else {
                res.render('files', { files: files });
            }
        }
    });
});

app.get('/login', function (req, res) {
    res.render('login');
});

app.post('/login', function (req, res, next) {
    passport.authenticate('local', function (err, user) {
        if (user) {
            req.logIn(user, function (err) {
                res.redirect('/');
            });
        }
        else {
            res.render('login', { message: 'Your login or password is incorrect.' });
        }
    })(req, res, next);
});

app.get('/register', function (req, res) {
    res.render('register');
});

app.post('/register', function (req, res) {
    const newUser = {
        username: req.body.username,
        email_1: req.body.email,
        password: req.body.password
    }
    User.register(newUser, req.body.password, function (err, user) {
        if (err) {
            res.render('register', { message: 'Your registration information was not valid (Either user already exists or invalid information)' });
        }
        else {
            passport.authenticate('local')(req, res, function () {
                res.redirect('/');
            });
        }
    });
});

app.listen(3000);

// app.listen(process.env.PORT || 3000);

// app.listen(36686, 'linserv1.cims.nyu.edu');

