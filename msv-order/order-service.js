const express = require('express');
const bodyParser = require('body-parser');
const amqp = require('amqplib');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize('order', 'root', 'mysql2024', {
  host: 'localhost',
  dialect: 'mysql'
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

// Connection with RabbitMQ
amqp.connect('amqp://rabbitmq:5672')
  .then((connection) => {
    connection.createChannel()
      .then((channel) => {
        const queue = 'products';
        channel.assertQueue(queue, {
          durable: false
        });
        
        channel.consume(queue, (message) => {
          console.log('Received message: ', message.content.toString());
          
          // Send confirmation message to RabbitMQ
          const confirmChannel = connection.createChannel();
          const confirmQueue = 'orders';
          const msg = 'Order processed';
          confirmChannel.sendToQueue(confirmQueue, Buffer.from(msg));
        });
      });
  })
  .catch((error) => console.error(error));

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

(async () => {
  await sequelize.sync();
  app.listen(3001, () => {
    console.log('Order service running on port 3001');
  });
})();
