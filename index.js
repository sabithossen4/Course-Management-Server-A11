const express = require('express')
const cors = require('cors');
require('dotenv').config()
const jwt = require('jsonwebtoken')
var admin = require("firebase-admin");
const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString(
  'utf-8'
)
var serviceAccount = JSON.parse(decoded)
const { getAuth } = require('firebase-admin/auth')
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express()
const port = process.env.PORT || 3000;

app.use(cors());

app.use(express.json());
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.o1uqrsp.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


// jwt middlewares
const verifyJWT = async (req, res, next) => {
  const token = req?.headers?.authorization?.split(' ')[1]
  // const token = req?.cookies?.token
  console.log(req.headers.authorization)
  if (!token) return res.status(401).send({ message: 'Unauthorized Access!' })
  try {
    const decoded = await admin.auth().verifyIdToken(token)
    req.tokenEmail = decoded.email
    console.log(decoded)
    next()
  } catch (err) {
    console.log(err)
    return res.status(401).send({ message: 'Unauthorized Access!' })
  } 
}


async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const coursesCollection = client.db('courseManagement').collection('courses');
    const enrollmentsCollection = client.db('courseManagement').collection('enrollments');


      // generate jwt
    app.post('/jwt', (req, res) => {
      // user hocche payload/data
      const user = { email: req.body.email }

      // token creation (payload/data encode)
      const token = jwt.sign(user, process.env.JWT_SECRET_KEY, {
        expiresIn: '7d',
      })

      // res
      //   .cookie('token', token, {
      //     httpOnly: true,
      //     secure: false,
      //   })
        .send({ message: 'JWT Created Successfully!' })

      // send token in response for localstorage method
      // res.send({ token, message: 'JWT Created Successfully!' })
    })


     app.get('/courses', async(req,res)=>{
        const result = await coursesCollection.find().toArray();
        res.send(result);
      });

      app.get('/courses/:id', async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const course = await coursesCollection.findOne(query);
    res.send(course);
});

app.get('/latest-courses', async (req, res) => {
  const result = await coursesCollection.find().sort({ createdAt: -1 }).limit(6).toArray();
  res.send(result);
});

 app.post('/courses', async(req,res) =>{
        const newCourses =req.body;
        console.log(newCourses);
        const result = await coursesCollection.insertOne(newCourses);
        res.send(result);
      }) 

      app.delete('/courses/:id', async(req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await coursesCollection.deleteOne(query);
    res.send(result);
})

    app.patch('/courses/:id', async(req, res) => {
    const id = req.params.id;
    const updatedData = req.body;
    const query = { _id: new ObjectId(id) };
    const update = {
        $set: updatedData
    };
    const result = await coursesCollection.updateOne(query, update);
    res.send(result);
})
   
 

app.post('/enroll', async (req, res) => {
  const { userEmail, courseId } = req.body;
  const alreadyEnrolled = await enrollmentsCollection.findOne({ userEmail, courseId });
  if (alreadyEnrolled) {
    return res.status(400).send({ message: "You are already enrolled in this course." });
  }  
  const userEnrollmentsCount = await enrollmentsCollection.countDocuments({ userEmail });
  if (userEnrollmentsCount >= 3) {
    return res.status(400).send({ message: "You cannot enroll in more than 3 courses." });
  }
  const result = await enrollmentsCollection.insertOne({ userEmail, courseId, enrolledAt: new Date() });
  await coursesCollection.updateOne(
    { _id: new ObjectId(courseId) },
    { $inc: { enrolledCount: 1 } }
  );
  res.send(result);
});




app.get('/enroll/user/:email', verifyJWT, async (req, res) => {

   const decodedEmail = req.tokenEmail;

  const userEmail = req.params.email;
  console.log('Email from JWT TOKEN---->', decodedEmail)
      console.log('Email from Params---->', userEmail)

   if (decodedEmail !== userEmail){
        return res.status(403).send({ message: 'Forbidden Access!' })
      }
  const enrollments = await enrollmentsCollection.find({ userEmail }).toArray();
  const courseIds = enrollments.map(item => new ObjectId(item.courseId));
  const courses = await coursesCollection.find({ _id: { $in: courseIds } }).toArray(); 
  const combined = enrollments.map(enrollment => {
    const course = courses.find(c => c._id.toString() === enrollment.courseId);
    return {
      enrollmentId: enrollment._id,
      ...course
    }
  });
  res.send(combined);
});


app.delete('/enroll/:id', async (req, res) => {
  const id = req.params.id;
  const enrollment = await enrollmentsCollection.findOne({ _id: new ObjectId(id) });
  if (!enrollment) {
    return res.status(404).send({ message: "Enrollment not found" });
  }
  const result = await enrollmentsCollection.deleteOne({ _id: new ObjectId(id) });
  await coursesCollection.updateOne(
    { _id: new ObjectId(enrollment.courseId) },
    { $inc: { enrolledCount: -1 } }
  );
  res.send(result);
});











    
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
  res.send('Wellcome Assignment-11')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
