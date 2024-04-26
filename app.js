require('dotenv').config();
require('express-async-errors');

// express
const express = require('express');
const app = express();

// rest of the packages
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const fileUpload = require('express-fileupload');

//  routers
const foodRouter = require('./routes/foodRouter');

// middleware
const notFoundMiddleware = require('./middleware/not-found');
const errorHandlerMiddleware = require('./middleware/error-handler');
const connectDB = require('./db/connect');

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(fileUpload({ useTempFiles: true }));
app.use(morgan('dev'));

app.use('/api/v1/food', foodRouter);
app.get('/', (req, res) => {
  res.status(200).json({ msg: 'Welcome to Home....' });
});

app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

const port = process.env.PORT || 5000;
const start = async () => {
  try {
    await connectDB(process.env.MONGO_CONNECTION_URL);

    app.listen(port, () =>
      console.log(`🟢 Server is listening on port ${port}...`)
    );
  } catch (error) {
    console.log(error);
  }
};

start();