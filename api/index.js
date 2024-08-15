///////////////////////////  DOING ALL THE IMPORTS of LIBRARIES ///////////////////////////////
const express = require('express');
const User = require('./models/User')
const connectToMongo = require('./db');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const {body , validationResult} = require('express-validator');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const fs = require('fs');
const Post = require('./models/Post');

////////////////////////////////////SETTING UP THE MIDDLEWARES/////////////////////////////////////////////////////////////////////
const app = express();
const uploadMiddleware = multer({ dest: 'uploads/' });
app.use(cors({ credentials: true, origin: 'http://localhost:3000' }));
app.use(express.json());
//adding a cookie parser to get the cookies of the requested user in order to obtain its profile
app.use(cookieParser());
app.use('/uploads', express.static(__dirname + '/uploads'));



/////////////////////// SOME CONSTANTS////////////////////////////////////
const PORT = 4000;
const secret = 'thisdayisanawesomeday'
const salt = bcrypt.genSaltSync(10);
////////////////CONNECTING TO THE DATABASE
connectToMongo();
///////////////////SETTING UP THE ROUTES //////////////////////////////////////////////////////////////

//Route for registering ///
app.post('/register',[
    body('username' , 'enter a valid email').isEmail(),
    body('password' , 'Password must be atleast 5 characters').isLength({min:5})
    
], async (req, res) => {
    const errors = validationResult(req);
if(!errors.isEmpty()){
    return res.status(400).json({errors:errors.array()})
}
    const { username, password } = req.body;
    try {
        const userDoc = await User.create({
            username,
            password: bcrypt.hashSync(password, salt)
        });
        res.json(userDoc);
    } catch (error) {
        res.status(400).json(error);
    }

})
//Route for login ///
app.post('/login',[
    body('username' , 'enter a valid email').isEmail(),
    body('password' , 'Password must be atleast 5 characters').isLength({min:5})
    
], async (req, res) => {
    const errors = validationResult(req);
if(!errors.isEmpty()){
    return res.status(400).json({errors:errors.array()})
}
    const { username, password } = req.body;
    const userDoc = await User.findOne({ username });
    const passOK = bcrypt.compareSync(password, userDoc.password);
    if (passOK) {
        //logged in, then we will respond with json web token
        jwt.sign({ username, id: userDoc._id }, secret, {}, (error, token) => {
            if (error) throw error;
            res.cookie('token', token).json({
                id: userDoc._id,
                username
            });
        })

    }
    else {
        res.status(400).json('wrong credentials!!!!');
    }
})
//Route to get the profile of the user   ///
app.get('/profile', (req, res) => {
    const token = req.cookies.token;
    jwt.verify(token, secret, {}, (err, info) => {
        if (err) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        res.json(info);
    });
});
////       Route to Logout      ////

app.post('/logout', (req, res) => {
    res.cookie('token', '').json('ok');
});
//// ROUTE TO CREATE A POST///////////
app.post('/post', uploadMiddleware.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    const { originalname, path } = req.file;
    const parts = originalname.split('.');
    const ext = parts[parts.length - 1];
    const newPath = path + '.' + ext;
    fs.renameSync(path, newPath);

    const { token } = req.cookies;
    jwt.verify(token, secret, {}, async (err, info) => {
        if (err) throw err;
        const { title, summary, content } = req.body;
        const postDoc = await Post.create({
            title,
            summary,
            content,
            cover: newPath,
            author: info.id,
        });
        res.json(postDoc);
    });

});


app.get('/post', async (req, res) => {
    res.json(
        await Post.find()
            .populate('author', ['username'])
            .sort({ createdAt: -1 })
            .limit(20)
    );
});
app.get('/post/:id', async (req, res) => {
    const { id } = req.params;
    const postDoc = await Post.findById(id).populate('author', ['username']);
    res.json(postDoc);
})

app.put('/post', uploadMiddleware.single('file'), async (req, res) => {
    let newPath = null;
    if (req.file) {
        const { originalname, path } = req.file;
        const parts = originalname.split('.');
        const ext = parts[parts.length - 1];
        newPath = path + '.' + ext;
        fs.renameSync(path, newPath);
    }

    const { token } = req.cookies;
    jwt.verify(token, secret, {}, async (err, info) => {
        if (err) throw err;
        const { id, title, summary, content } = req.body;
        const postDoc = await Post.findById(id);
        const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
        if (!isAuthor) {
            return res.status(400).json('you are not the author');
        }

        // Update the document
        await Post.findByIdAndUpdate(id, {
            title,
            summary,
            content,
            cover: newPath ? newPath : postDoc.cover,
        });

        // Retrieve the updated document
        const updatedPost = await Post.findById(id);

        res.json(updatedPost);
    });
});
app.delete('/delete/:id', async (req, res) => {
    const { token } = req.cookies;
    jwt.verify(token, secret, {}, async (err, info) => {
        if (err) {
            return res.status(401).send("Unauthorized: Invalid or expired token");
        }
        
        const { id } = req.params;
        const postDoc = await Post.findById(id);
        if (!postDoc) {
            return res.status(404).send("Post not found");
        }
        
        const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
        if (!isAuthor) {
            return res.status(401).send("Unauthorized: You are not the author of this post");
        }
        
        // Delete the post
        await Post.findByIdAndDelete(id);
        res.json('Post has been deleted');
    });
});



app.listen(PORT, () => {
    console.log(`app is running fine on ${PORT}`);
}
)




// throw is used to manually add an error it interrupts the normal flow of the code execution and generates an error object with a specified message and optional properties.

// app.use(cors({credentials:true,origin:'http://localhost:3000'}));: This line sets up Cross-Origin Resource Sharing (CORS) for your Express application. CORS is a security feature implemented by web browsers to restrict web pages from making requests to a domain that is different from the one that served the page. By using app.use(cors()), you are allowing requests from a different origin (http://localhost:3000 in this case) to access your server resources. The credentials: true option indicates that cookies and other credentials should be included in cross-origin requests.

// app.use(express.json());: This line sets up middleware to parse incoming request bodies with JSON payloads. When a request with a JSON payload is received by your Express server, this middleware parses the JSON data and makes it available in req.body for further processing in your route handlers.

// app.use(cookieParser());: This line sets up middleware to parse cookies attached to incoming requests. When a request contains cookies, this middleware parses the cookie header and makes the cookie data available in req.cookies for further processing in your route handlers. This is useful when you need to access cookies sent by the client, such as session tokens or authentication cookies.
//This line of code serves static files from the uploads directory.

//app.use('/uploads', ...): This tells Express to use the middleware function provided for any requests that begin with /uploads.