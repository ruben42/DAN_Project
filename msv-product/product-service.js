const express = require('express');
const bodyParser = require('body-parser');
const amqp = require('amqplib');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize('product', 'root', 'mysql2024', {
  host: 'localhost',
  dialect: 'mysql'
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

// Connection with RabbitMQ
amqp.connect('amqp://rabbitmq:5672', (error0, connection) => {
  if (error0) {
    throw error0;
  }
  connection.createChannel((error1, channel) => {
    if (error1) {
      throw error1;
    }

    const queue = 'products';

    channel.assertQueue(queue, {
      durable: false
    });

    // Receive message
    channel.consume(queue, (message) => {
      console.log('Received message: ', message.content.toString());

      // Send confirmation message to RabbitMQ
      const confirmChannel = connection.createChannel();
      const confirmQueue = 'orders';
      const msg = 'Order processed';
      confirmChannel.sendToQueue(confirmQueue, Buffer.from(msg));
    }, {
      noAck: true
    });
  });
});

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

(async () => {
  await sequelize.sync();
  app.listen(3000, () => {
    console.log('Product service running on port 3000');
  });
})();
