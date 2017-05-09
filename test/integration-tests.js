const chai = require('chai');
const chaiHttp = require('chai-http');
const faker = require('faker');
const mongoose = require('mongoose');

// this makes the should syntax available throughout
// this module
const should = chai.should();

const {BlogPost} = require('../models');
const {app, runServer, closeServer} = require('../server');
const {TEST_DATABASE_URL} = require('../config');

chai.use(chaiHttp);

// used to put randomish documents in db
// so we have data to work with and assert about.
// we use the Faker library to automatically
// generate placeholder values for author, title, content
// and then we insert that data into mongo
function seedBlogData() {
  console.info('seeding blog data');
  const seedData = [];

  for (let i=1; i<=10; i++) {
    seedData.push(generateBlogData());
  }
  // this will return a promise
  return BlogPost.insertMany(seedData);
}

// used to generate data to put in db
// function generateTitle() {
//   const title = 
//   [
//     "21 things -- you won't believe #4", 
//     "22 things -- you won't believe #4", 
//     "23 things -- you won't believe #4", 
//     "24 things -- you won't believe #4", 
//     "25 things -- you won't believe #4"
//     ];
//   return title[Math.floor(Math.random() * title.length)];
// }

// // used to generate data to put in db
// function generateAuthor() {
//   const author = ['Italian', 'Thai', 'Colombian'];
//   return author[Math.floor(Math.random() * author.length)];
// }

// // used to generate data to put in db
// function generateContent() {
//   const content = [
//   'Lorem ipsum dolor sit amet, consectetur adipisicing elit',
//    'Lorem ipsum dolor sit amet, consectetur adipisicing elit',
//     'Lorem ipsum dolor sit amet, consectetur adipisicing elit',
//      'Lorem ipsum dolor sit amet, consectetur adipisicing elit', 
//      'Lorem ipsum dolor sit amet, consectetur adipisicing elit'];
//     return content [Math.floor(Math.random() * content.length)];

// }


// generate an object represnting a restaurant.
// can be used to generate seed data for db
// or request.body data
function generateBlogData() {
  return {
   
    title: faker.company.companyName(),
      author: {
        firstName: faker.name.firstName(),
        lastName: faker.name.lastName()
      },
    content: faker.lorem.sentence(),
    date:faker.date.past()



 }   
}


// this function deletes the entire database.
// we'll call it in an `afterEach` block below
// to ensure  ata from one test does not stick
// around for next one
function tearDownDb() {
    console.warn('Deleting database');
    return mongoose.connection.dropDatabase();
}

describe('Blog API resource', function() {

  // we need each of these hook functions to return a promise
  // otherwise we'd need to call a `done` callback. `runServer`,
  // `seedRestaurantData` and `tearDownDb` each return a promise,
  // so we return the value returned by these function calls.
  before(function() {
    return runServer(TEST_DATABASE_URL);
  });

  beforeEach(function() {
    return seedBlogData();
  });

  afterEach(function() {
    return tearDownDb();
  });

  after(function() {
    return closeServer();
  })

  // note the use of nested `describe` blocks.
  // this allows us to make clearer, more discrete tests that focus
  // on proving something small
  describe('GET endpoint', function() {

    it('should return all existing blogs', function() {
      // strategy:
      //    1. get back all restaurants returned by by GET request to `/restaurants`
      //    2. prove res has right status, data type
      //    3. prove the number of restaurants we got back is equal to number
      //       in db.
      //
      // need to have access to mutate and access `res` across
      // `.then()` calls below, so declare it here so can modify in place
      let res;
      return chai.request(app)
        .get('/posts')
        .then(function(_res) {
          // so subsequent .then blocks can access resp obj.
          res = _res;
          console.log("res.body.blogposts"+res.body.blogposts);
          res.should.have.status(200);
          res.body.should.be.a('array');
          //res.body.should.have.property('title');
          // console.log("res"+res.json);
          // console.log("blog"+BlogPost.count());
          // // otherwise our db seeding didn't work
          res.body.should.have.length.of.at.least(1);
          return BlogPost.count();

        })

        .then(function(count) {
          // console.log("count"+count);
          // console.log("res.body.blogposts*******"+JSON.stringify(res.body, null, 4));
          res.body.should.have.length.of(count);
        });
    });


    it('should return restaurants with right fields', function() {
      // Strategy: Get back all restaurants, and ensure they have expected keys

      let resPosts;
      return chai.request(app)
        .get('/posts')
        .then(function(res) {
          res.should.have.status(200);
          res.should.be.json;
          res.body.should.be.a('array');
          res.body.should.have.length.of.at.least(1);

          res.body.forEach(function(blogpost) {
            blogpost.should.be.a('object');
            blogpost.should.include.keys(
              'id', 'author', 'title', 'content','created');
          });
          resPosts = res.body[0];
          return BlogPost.findById(resPosts.id);
        })
        .then(function(blogpost) {

          resPosts.id.should.equal(blogpost.id);
          resPosts.title.should.equal(blogpost.title);
          resPosts.author.should.equal(blogpost.author.firstName+" "+blogpost.author.lastName);
          // console.log("resPosts.author"+resPosts.author);
          // console.log("blogpost.author"+blogpost.author.firstName+" "+blogpost.author.lastName);
          resPosts.content.should.equal(blogpost.content);
          
        });
    });
  });

  describe('POST endpoint', function() {
    // strategy: make a POST request with data,
    // then prove that the restaurant we get back has
    // right keys, and that `id` is there (which means
    // the data was inserted into db)
    it('should add a new blogpost', function() {

      const newBlog = generateBlogData();
      

      return chai.request(app)
        .post('/posts')
        .send(newBlog)
        .then(function(res) {
          res.should.have.status(201);
          res.should.be.json;
          res.body.should.be.a('object');
          res.body.should.include.keys(
            'id', 'title', 'content', 'author', 'created');
          res.body.title.should.equal(newBlog.title);
          // cause Mongo should have created id on insertion
          res.body.id.should.not.be.null;
          res.body.title.should.equal(newBlog.title);
         res.body.author.should.equal(newBlog.author.firstName+" "+newBlog.author.lastName);

           res.body.content.should.equal(newBlog.content);
          return BlogPost.findById(res.body.id).exec();
        })
        .then(function(post) {
          post.title.should.equal(newBlog.title);
          post.content.should.equal(newBlog.content);
          post.author.firstName.should.equal(newBlog.author.firstName);
          post.author.lastName.should.equal(newBlog.author.lastName);
        });
    });
  });

  describe('PUT endpoint', function() {

    // strategy:
    //  1. Get an existing restaurant from db
    //  2. Make a PUT request to update that restaurant
    //  3. Prove restaurant returned by request contains data we sent
    //  4. Prove restaurant in db is correctly updated
    it('should update fields you send over', function() {
      const updateData = {
        title: 'fofofofofofofof',
        author: 
        {firstName:'futuristic',
        lastName:' fusion'},
        content:'lololo'
      };

      return BlogPost
        .findOne()
        .exec()
        .then(function(post) {
          updateData.id = post.id;

          // make request then inspect it to make sure it reflects
          // data we sent
          return chai.request(app)
            .put(`/posts/${post.id}`)
            .send(updateData);
        })
        .then(function(res) {
          res.should.have.status(201);
          res.should.be.json;
          res.body.should.be.a('object');
          res.body.should.include.keys(
            'id', 'title', 'content', 'author', 'created');
          res.body.title.should.equal(updateData.title);
          // cause Mongo should have created id on insertion
          res.body.id.should.not.be.null;
          res.body.title.should.equal(updateData.title);
         res.body.author.should.equal(updateData.author.firstName+" "+updateData.author.lastName);

           res.body.content.should.equal(updateData.content);

          return BlogPost.findById(updateData.id).exec();
        })
        .then(function(post) {
          post.title.should.equal(updateData.title);
          post.content.should.equal(updateData.content);
           post.author.firstName.should.equal(updateData.author.firstName);
          post.author.lastName.should.equal(updateData.author.lastName);
        });
      });
  
});

  describe('DELETE endpoint', function() {
    // strategy:
    //  1. get a restaurant
    //  2. make a DELETE request for that restaurant's id
    //  3. assert that response has right status code
    //  4. prove that restaurant with the id doesn't exist in db anymore
    it('delete a blogpost by id', function() {
let blogpost;

      return BlogPost
        .findOne()
        .exec()
        .then(function(_blog) {
          blogpost = _blog;
          return chai.request(app).delete(`/posts/${blogpost.id}`);
        })
      
        .then(function(res) {
          res.should.have.status(204);
          return BlogPost.findById(blogpost.id).exec();
        })
        .then(function(_blog) {
          // when a variable's value is null, chaining `should`
          // doesn't work. so `_restaurant.should.be.null` would raise
          // an error. `should.be.null(_restaurant)` is how we can
          // make assertions about a null value.
          should.not.exist(_blog);
        });
    });
  });
});
