require('dotenv').config()
const express = require('express')
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const app = express();
const cors = require('cors')

const secretToken = process.env.JWT_SECRET_TOKEN;
// Middleweres

const corsOptions = {
  origin: '*',
  credentials: true,
  optionSuccessStatus: 200,
}

app.use(cors(corsOptions))
app.use(express.json())
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: "Unauthorized access" })
  }
  // bearer
  const token = authorization.split(' ')[1]
  jwt.verify(token, secretToken, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: "Unauthorized access" })
    }
    req.decoded = decoded;
    next();
  })


}


// ~~~~~~~~~~~~~~~~~~~~~~~~~~MongoDB Configarations~~~~~~~~~~~~~~~~~~~~


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zycuvps.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // client.connect();
    // Collections
    const courseCollection = client.db('medlanddb').collection('courses')
    const cartCollection = client.db('medlanddb').collection('carts')
    const usersCollection = client.db('medlanddb').collection('users')
    const paymentCollection = client.db('medlanddb').collection('payment')

    app.post('/jwt', (req, res) => {
      const user = req.body
      const token = jwt.sign(user, secretToken, {
        expiresIn: '1h',
      })
      res.send({ token })
    })
    // use verifyjwt first
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query)
      if (user?.role !== 'admin') {
        return res.status(401).send({ error: true, message: "Forbidden access" })
      }
      next();
    }
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query)
      if (user?.role !== 'instructor') {
        return res.status(401).send({ error: true, message: "Forbidden access" })
      }
      next();
    }
    app.get('/users/admin/:email', verifyJWT, async (req, res, next) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ admin: false })
      }
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === 'admin' }
      res.send(result)
    })
    app.get('/pendingClasses', async (req, res) => {
      const status = req.query.status;
      const query = { status: status }
      const result = await courseCollection.find(query).toArray()
      res.send(result)
    })
    app.get('/users/instructor/:email', verifyJWT, async (req, res, next) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ instructor: false })
      }
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { instructor: user?.role === 'instructor' }
      res.send(result)
    })

    app.get('/courses', async (req, res) => {
      const result = await courseCollection.find().toArray()
      res.send(result)
    })
    app.get('/instructorClasses', verifyJWT, async (req, res) => {
      const email = req.query.email
      console.log(email);
      const query = { instructor_email: email }
      const result = await courseCollection.find(query).toArray()
      res.send(result)
    })
    app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray()
      res.send(result);
    })

    app.get('/carts', verifyJWT, async (req, res) => {
      const email = req.query.email;
      console.log(email);
      if (!email) {
        res.send([])
      }
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(401).send({ error: true, message: "Forbidden access" })
      }
      const query = { email: email }
      console.log(query)
      const result = await cartCollection.find(query).toArray()
      res.send(result);
    })
    app.get('/test', (req, res) => {
      res.send("{This is a test}")
    })

    // cart collection related api
    app.post('/carts', async (req, res) => {
      const item = req.body
      console.log(item)
      const result = cartCollection.insertOne(item)
      res.send(result)
    })
    app.post('/users', async (req, res) => {
      const user = req.body;
      console.log(user)
      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query)
      if (existingUser) {
        return res.send({ message: 'user already exist' })
      }
      const result = await usersCollection.insertOne(user)
      res.send(result)
    })
    app.post('/instructor/addCourses', async (req, res) => {
      const course = req.body;
      const result = await courseCollection.insertOne(course)
      res.send(result);
    })
    app.post('/courses', async (req, res) => {
      const course = req.body;
      const result = await courseCollection.insertOne(course)
      res.send(result)
    })
    // course collection apies
    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          role: "admin"
        }
      }
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result)

    })
    app.patch('/users/instructor/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          role: "instructor"
        }
      }
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result)
    })
    app.patch('/users/user/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          role: "user"
        }
      }
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result)
    })
    app.patch('/courses/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          status: "approved",
        }
      }
      const result = await courseCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })
    app.patch('/bookSeat/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const booked = await courseCollection.findOne(query)
      return res.send(booked)
      const updateStudents = {
        $set: {
          students: parseInt(booked.students) + 1,
        }
      }
      const result = await courseCollection.updateOne(updateStudents)
      res.send(result)
    })
    app.patch('/rejectedCourses/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          status: "rejected",
        }
      }
      const result = await courseCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    // Delete apis
    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await cartCollection.deleteOne(query)
      res.send(result)
    })
    app.delete('/users/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await usersCollection.deleteOne(query);
      res.send(result)
    })



    // Payment API
    app.post('/create-payment-intent',verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card'],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      })
    })

    app.post('/payments',verifyJWT, async(req,res)=>{
      const payment = req.body;
      const result = await paymentCollection.insertOne(payment);
      res.send(result)
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);





//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~MONGODB ENDS~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
app.get("/", (req, res) => {
  res.send("MEDLFIE is running!")
})

app.listen(port, () => {
  console.log('Medlife is running on port', port);
})

