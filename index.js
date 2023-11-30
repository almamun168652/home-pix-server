const express = require("express");
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require("cors");
const jwt = require('jsonwebtoken');
require('dotenv').config();
const stripe = require("stripe")(process.env.PAYMENT_KEY_BACKEND)
const port = process.env.PORT || 5000;


// Middle Were 
app.use(cors({
    origin: ['https://aback-spoon.surge.sh']
}));
app.use(express.json());







const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ywavnlw.mongodb.net/?retryWrites=true&w=majority`;

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
        // await client.connect();


        const userCollection = client.db("homePixDB").collection("users");
        const propertyCollection = client.db("homePixDB").collection("properties");
        const wishlistCollection = client.db("homePixDB").collection("wishlist");
        const offeredCollection = client.db("homePixDB").collection("offered");
        const reviewCollection = client.db("homePixDB").collection("review");
        const advertiseCollection = client.db("homePixDB").collection("advertise");
        const paymentCollection = client.db("homePixDB").collection("payment");



        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.send({ token });
        })

        // middlewares
        const verifyToken = (req, res, next) => {
            console.log('inside verify token', req.headers.authorization);
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'forbidden access' });
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'forbidden access' });
                }
                req.decoded = decoded;
                next();
            })

        }


        // use verify admin after verify token
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            next();
        }

        // use verify agent after verify token
        const verifyAgent = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isAgent = user?.role === 'agent';
            if (!isAgent) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            next();
        }




        // users related api
        //user post
        app.post('/users', async (req, res) => {
            try {
                const user = req.body;
                const query = { email: user.email }
                const existingUser = await userCollection.findOne(query);
                if (existingUser) {
                    return res.send({ message: 'user already exists', insertedId: null })
                }
                const result = await userCollection.insertOne(user);
                res.send(result);
            } catch (error) {
                console.log(error);
            }
        })
        // users get 
        // only admin
        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        })

        // only admin
        app.get('/allReviews', verifyToken, verifyAdmin, async (req, res) => {
            const result = await reviewCollection.find().toArray();
            res.send(result);
        })


        // get single properties by id
        app.get('/wishlist/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await wishlistCollection.findOne(query);
            res.send(result);
        })

        // get single user for admin agent and user
        app.get('/users/role/:email', async (req, res) => {
            try {
                const email = req.params?.email;
                const query = { email: email }
                const result = await userCollection.findOne(query);
                res.send(result);
            } catch (err) {
                console.log(err)
            }
        })


        // admin load
        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'unauthorized access' });
            }

            const query = { email: email };
            const user = await userCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user?.role === 'admin';
            }
            res.send({ admin });
        })

        // agent load
        app.get('/users/agent/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'unauthorized access' });
            }

            const query = { email: email };
            const user = await userCollection.findOne(query);
            let agent = false;
            if (user) {
                agent = user?.role === 'agent';
            }
            res.send({ agent });
        })


        // make admin
        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })
        // make agent
        app.patch('/users/agent/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    role: 'agent'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })


        // mark fraud
        app.patch('/users/fraud/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    role: 'fraud'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })



        // user delete
        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await userCollection.deleteOne(query);
            res.send(result);
        })



        // ==============================
        // agent

        // property
        app.post('/property', verifyToken, verifyAgent, async (req, res) => {
            const item = req.body;
            const result = await propertyCollection.insertOne(item);
            res.send(result);
        })


        app.post('/wishlist', verifyToken, async (req, res) => {
            const item = req.body;
            const result = await wishlistCollection.insertOne(item);
            res.send(result);
        })


        app.post('/review', verifyToken, async (req, res) => {
            const item = req.body;
            const result = await reviewCollection.insertOne(item);
            res.send(result);
        })

        app.post('/offered', verifyToken, async (req, res) => {
            const item = req.body;
            const result = await offeredCollection.insertOne(item);
            res.send(result);
        })

        // my review
        app.get('/myReview', async (req, res) => {
            try {
                const email = req.query?.email;
                console.log(email);
                const query = { userEmail: email }
                const result = await reviewCollection.find(query).toArray();
                res.send(result);
            } catch (err) {
                console.log(err)
            }
        })

        // delete property
        app.delete("/review/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await reviewCollection.deleteOne(query);
            res.send(result);
        })




        // added properties
        app.get('/myBought', async (req, res) => {
            try {
                const email = req.query?.email;
                console.log(email);
                const query = { buyerEmail: email }
                const result = await offeredCollection.find(query).toArray();
                res.send(result);
            } catch (err) {
                console.log(err)
            }
        })


        // added properties
        app.get('/properties', async (req, res) => {
            try {
                const email = req.query?.email;
                const query = { agentEmail: email }
                const result = await propertyCollection.find(query).toArray();
                res.send(result);
            } catch (err) {
                console.log(err)
            }
        })

        // added properties
        app.get('/myRequested', async (req, res) => {
            try {
                const email = req.query?.email;
                const query = { agentEmail: email }
                const result = await offeredCollection.find(query).toArray();
                res.send(result);
            } catch (err) {
                console.log(err)
            }
        })

        // request update
        // make verify
        app.patch('/request/accept/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    status: 'accepted'
                }
            }
            const result = await offeredCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        app.patch('/request/reject/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    status: 'rejected'
                }
            }
            const result = await offeredCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })


        // get single properties by id
        app.get('/addedProperties/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await propertyCollection.findOne(query);
            res.send(result);
        })

        // // update property
        app.patch('/properties/update/:id', async (req, res) => {
            const item = req.body;
            const id = req.params.id;
            const filter = { $or: [{ _id: new ObjectId(id) }, { _id: id }] };
            const updateDoc = {
                $set: {
                    propertyTitle: item.propertyTitle,
                    propertyLocation: item.propertyLocation,
                    propertyImage: item.propertyImage,
                    agentName: item.agentName,
                    agentEmail: item.agentEmail,
                    startPrice: item.startPrice,
                    endPrice: item.endPrice
                }
            }
            const result = await propertyCollection.updateOne(filter, updateDoc);
            res.send(result)
        })

        // delete property
        app.delete("/addedProperty/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await propertyCollection.deleteOne(query);
            res.send(result);
        })


        // user only
        // get wishlist
        app.get('/wishlist', async (req, res) => {
            const result = await wishlistCollection.find().toArray();
            res.send(result);
        })



        // Admin Only
        // get Properties
        app.get('/allProperties', async (req, res) => {
            const result = await propertyCollection.find().toArray()
            res.send(result)
        })

        app.get('/verifiedProperties', async (req, res) => {
            const query = { status: 'verified' }
            const result = await propertyCollection.find(query).toArray();
            res.send(result);
        })

        app.get('/verifiedProperty/details/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await propertyCollection.findOne(query);
            res.send(result);
        })




        // make verify
        app.patch('/property/verified/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    status: 'verified'
                }
            }
            const result = await propertyCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        // make rejected
        app.patch('/property/rejected/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    status: 'rejected'
                }
            }
            const result = await propertyCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        app.post('/advertise', verifyToken, async (req, res) => {
            const item = req.body;
            const count = await advertiseCollection.estimatedDocumentCount();
            if (count < 6) {
                const result = await advertiseCollection.insertOne(item);
                res.send(result);
            } else {
                res.send({ message: 'You can not add advertise greater than 6 items' });
                console.log('You can not add advertise greater than 6 items');
            }

        })

        // delete property
        app.delete("/advertise/:id", async (req, res) => {
            const id = req.params.id;
            const query = { advertiseId: id }
            const result = await advertiseCollection.deleteOne(query);
            res.send(result);
        })


        // advertise get for home page
        app.get('/bestCollection', async (req, res) => {
            const result = await advertiseCollection.find().toArray();
            res.send(result);
        })





        // ===================
        app.get('/fraudAgentProperties/:email', async (req, res) => {
            const email = req.params.email;
            const query = { agentEmail: email, status: 'verified' }
            const result = await propertyCollection.find(query).toArray();
            res.send(result);
        })

        // ===================
        app.get('/soldProperties', async (req, res) => {
            const email = req.query?.email;
            const query = { agentEmail: email, status: 'bought' }
            const result = await offeredCollection.find(query).toArray();
            res.send(result);
        })


        app.post('/fraudPropertyCick', async (req, res) => {
            const idsArray = req.body;
            const query = { _id: { $in: idsArray.map(id => new ObjectId(id)) } };
            const result = await propertyCollection.deleteMany(query);
            res.send(result);
        })

        // ===================
        app.get('/fraudAdvertise/:email', async (req, res) => {

            const email = req.params.email;
            const query = { agentEmail: email, status: 'verified' }
            const result = await advertiseCollection.find(query).toArray();
            res.send(result);
        })

        app.post('/fraudAdvertiseCick', async (req, res) => {
            const idsArray = req.body;
            const query = { _id: { $in: idsArray.map(id => new ObjectId(id)) } };
            const result = await advertiseCollection.deleteMany(query);
            res.send(result);
        })

        // 



        // ===========latest reviw ===========
        app.get('/latestReview', async (req, res) => {
            const recentReviews = await reviewCollection.find().sort({ _id: -1 }).limit(3).toArray();
            res.send(recentReviews);
        })


        // ==================================
        app.get('/goPay/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const query = { _id: new ObjectId(id) };
            const result = await offeredCollection.findOne(query);
            res.send(result);
        })



        // post :: payment gateway
        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            // console.log(amount, 'amount inside the intent')

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });

            res.send({
                clientSecret: paymentIntent.client_secret
            })
        });

        //  post :: payments and user data
        app.put('/payments', async (req, res) => {
            const payment = req.body;
            console.log(payment);
            // const result = await paymentCollection.insertOne(payment);
            // res.send(result);

            const filter = { _id: new ObjectId(payment.propertyId) }
            const updatedDoc = {
                $set: {
                    status: payment.status,
                    transactionId: payment.transtionId,
                }
            }
            const result = await offeredCollection.updateOne(filter , updatedDoc);
            res.send(result);


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








app.get('/', (req, res) => {
    res.send('home pix is running...')
})

app.listen(port, () => {
    console.log(`Home pix is running on port : ${port}`);
})