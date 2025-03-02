const express = require('express');
const bodyParser = require('body-parser');
const amqp = require('amqplib');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'mysql',
  host: 'mysql1',
  port: 3306,
  username: 'root',
  password: 'mysql2024',
  database: 'order'
});

const Order = sequelize.define('orders', {
    product: {
      type: DataTypes.STRING,
      allowNull: false
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

// API endpoint to get all orders 
app.get('/orders', async (req, res) => { 
  const orders = await Order.findAll(); 
  res.render('orders', { orders }); 
});

// API endpoint to render order creation form page
app.get('/order', async (req, res) => {
  res.render('create-order');
});

// API endpoint for adding an order
app.post('/order', async (req, res) => {
  const { product } = req.body;
  if (!product) {
    return res.status(400).json({ error: 'Product is required' });
  }

  try {
    const newOrder = new Order({ product });
    await newOrder.save();
    
    // Envio da mensagem para a fila correta
    const channel = await connection.createChannel();
    const queue = 'products';
    const msg = product;
    channel.sendToQueue(queue, Buffer.from(msg));

    res.redirect('/orders');
  } catch (error) {
    res.redirect('/orders');
  }
});

app.listen(3001, () => {
  console.log('Order service running on port 3001');
});
