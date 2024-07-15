const express = require('express');
const bodyParser = require('body-parser');
const amqp = require('amqplib');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'mysql',
  host: 'mysql',
  port: 3306,
  username: 'root',
  password: 'mysql2024',
  database: 'product'
});


const Product = sequelize.define('products', {
  name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
          notNull: {
              msg: 'Name is required'
          }
      }
  }
});

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

/*  VIEW ENGINE */
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

let connection;

const connectToRabbitMQ = async () => {
  let attempts = 0;
  while (attempts < 10) {
    try {
      connection = await amqp.connect('amqp://rabbitmq:5672');
      console.log('Connected to RabbitMQ');
      return;
    } catch (error) {
      attempts++;
      console.error(`Attempt ${attempts} failed to connect to RabbitMQ: ${error.message}`);
      await new Promise(res => setTimeout(res, 5000));
    }
  }
  throw new Error('Failed to connect to RabbitMQ after 10 attempts');
};

// Connection with RabbitMQ
connectToRabbitMQ()
  .then(() => connection.createChannel())
  .then((channel) => {
    const queue = 'products';
    channel.assertQueue(queue, {
      durable: false
    });

    channel.consume(queue, (message) => {
      console.log('Received message: ', message.content.toString());

      // Send confirmation message to RabbitMQ
      connection.createChannel().then((confirmChannel) => {
        const confirmQueue = 'orders';
        const msg = 'Order processed';
        confirmChannel.sendToQueue(confirmQueue, Buffer.from(msg));
      });
    });
  })
  .catch((error) => console.error(error));

// Sync with DB
const syncWithDB = async () => {
  let attempts = 0;
  while (attempts < 10) {
    try {
      await sequelize.sync();
      console.log('Database connected and synced');
      return;
    } catch (error) {
      attempts++;
      console.error(`Attempt ${attempts} failed to connect to the database: ${error.message}`);
      await new Promise(res => setTimeout(res, 5000));
    }
  }
  throw new Error('Failed to connect to the database after 10 attempts');
};

syncWithDB();

// API endpoint for root path
app.get('/', async (req, res) => {
  res.render('index'); 
});

// API endpoint to get all products
app.get('/products', async (req, res) => { 
  const products = await Product.findAll(); 
  res.render('products', { products }); 
});

// API endpoint to render product creation form page
app.get('/product', async (req, res) => {
  res.render('add-product');
});

// API endpoint for adding a product
app.post('/product', async (req, res) => {
  const { name } = req.body;
  if (!name) {
      return res.status(400).json({ error: 'Name is required' });
  }

  try {
      const newProduct = new Product({ name });
      await newProduct.save();

      // Send message to RabbitMQ
      const channel = await connection.createChannel();
      const queue = 'orders';
      const msg = name;
      channel.sendToQueue(queue, Buffer.from(msg));

      res.redirect('/products');
  } catch (error) {
      res.redirect('/products');
  }
});

app.listen(3000, () => {
  console.log('Product service running on port 3000');
});
