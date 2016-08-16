const express = require('express');
const app = express();
const port = process.env.PORT || 3000; //set the port to server port or 3000 for local testing

const mongo = require('mongodb').MongoClient;
const mlabURI = process.env.MLAB_URI; //get the DB url from envrionment variable


//serve static assets from the public folder
app.use('/assets', express.static(__dirname + '/public'));

//landing page route
app.get('/', function(req, res) {
  res.sendFile('index.html', {
    root: __dirname + '/public/pages'
  }, function(err) {
    if (err) throw err;
  });
});

//route for the input of a url to shorten
app.get(/^\/(https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_,!\+.~#?&//=]*))/, function(req, res) {
  var url = req.params[0]; //get the passed url via the first capture group from the RegEx
  console.log("URL Passed to API: " + url);

  mongo.connect(mlabURI).then((db) => {
    console.log("Connected to DB at mLab.");
    //open the collection of links
    var links = db.collection('links');

    //search for the original URL
    var searchForDuplicateURL = links.find({
      originalURL: url
    }, {
      _id: false,
      originalURL: true,
      shortURL: true
    }).toArray();

    var getAllIDs = links.find({}, {
      originalURL: false,
      shortURL: false
    }).toArray();

    searchForDuplicateURL.then((docs) => {
      console.log("Search for duplicate URL complete.");

      //if duplicate found return it
      if (docs.length > 0) {
        console.log("Duplicate URL found. Returning existing doc from DB.");
        db.close();
        res.json(docs[0]);
      }

      //duplicate URL not found
      //search for duplicate ID
      else {
        console.log("Duplicate URL not found. Checking for duplicate ID.");
        var id = Math.random().toString(36).slice(-4); //generate a random 4 digit id in base36 to be used to create short URL
        console.log("Initial ID generated: " + id);

        getAllIDs.then((docIDs) => {
          var ids = docIDs.map(doc => doc._id );
          console.log("IDs currently contained in DB: " + ids);

          //if a duplicate ID is found then a new ID needs to be generated
          while (ids.includes(id)) {
            console.log("Duplicate ID found.");
            id = Math.random().toString(36).slice(-4); //generate a new random 4 digit id in base36 to be used to create short URL
            console.log("New ID generated: " + id);
          }

          //with a unique ID established insert the new link doc into the DB
          links.insert({
            _id: id,
            originalURL: url,
            shortURL: "https://url-microservice-project.herokuapp.com/" + id
          }).then(() => {
            //close the database
            db.close();
            console.log("New document added to DB.");
            //respond with the created json object
            res.json({
              originalURL: url,
              shortURL: "https://url-microservice-project.herokuapp.com/" + id
            });
          });
        }).catch((err)=>{
          console.log(err);
        });

      }
    }).catch((err) => {
      console.log(err);
    });

  }).catch((err) => {
    console.log(err);
  });
});

//route for the input of a shortened url to redirect
app.get(/^\/([a-z0-9]{4}$)/, function(req, res) {
  var id = req.params[0]; //get the passed id via the first capture group from the RegEx
  console.log("Valid ID passed: " + id);

  mongo.connect(mlabURI).then((db) => {
    console.log("Connected to DB at mLab.");
    //open the collection of links
    var links = db.collection('links');

    //search for the original URL
    var searchID = links.find({
      _id: id
    }).toArray();

    //redirect user to the original URL contained in the document
    searchID.then((doc) => {
      console.log("Searching for id.");

      //id was found, redirect client
      if(doc.length > 0){
        console.log("Search for id complete. Redirecting client.");
        db.close();
        res.redirect(doc[0].originalURL);
      }

      //id was not found in database return error json
      else {
        console.log("ID not found. Responding with error JSON.");
        db.close();
        res.json({
          error: "Invalid URL."
        });
      }
    }).catch((err) => {
      console.log(err);
    });

  }).catch((err) => {
    console.log(err);
  });
});

app.get('/*', function(req, res){
  console.log("Invalid URL passed. Responding with error JSON.");
  res.json({
    error: "Invalid URL."
  });
});

app.listen(port);
