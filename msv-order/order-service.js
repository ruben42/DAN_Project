const express = require('express');
const bodyParser = require('body-parser');
const amqp = require('amqplib');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize('mysql://root:mysql2024@localhost:3306/order');

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

// Connect to RabbitMQ
setTimeout(() => {
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
  
      channel.consume(queue, (message) => {
        // Send confirmation message to RabbitMQ
        const channel = connection.createChannel();
        const queue = 'products'; // Alterado para a fila de produtos
        const msg = 'Order processed'; // Mensagem de confirmação
        channel.sendToQueue(queue, Buffer.from(msg));
      }, {
        noAck: true
      });
      
    });
  });
}, 5000);

// Connect to RabbitMQ
/*amqp.connect('amqp://rabbitmq:5672', (error0, connection) => {
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
    /*channel.consume(queue, async (message) => {
      const productName = JSON.parse(message.content.toString()).name;
      const productData = await Product.findOne({ name: productName });
      const newOrder = new Order({ product: productData });
      await newOrder.save();

      console.log('Order created with product: ', productName);
    }, {
      noAck: true
    });*/

    // Receive message
    /*channel.consume(queue, (message) => {
      console.log('Product received: ', JSON.parse(message.content.toString()));
    }, {
      noAck: true
    });

    channel.consume(queue, (message) => {
      // Send confirmation message to RabbitMQ
      const channel = connection.createChannel();
      const queue = 'products'; // Alterado para a fila de produtos
      const msg = 'Order processed'; // Mensagem de confirmação
      channel.sendToQueue(queue, Buffer.from(msg));
    }, {
      noAck: true
    });
  });
});*/

// Sync the model with the database
//sequelize.sync();

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

      // Send message to RabbitMQ
      const channel = await connection.createChannel();
      const queue = 'orders';
      const msg = product;
      channel.sendToQueue(queue, Buffer.from(msg));

      res.redirect('/orders');
  } catch (error) {
      //return res.status(500).json({ error: 'Failed to create product' });
      res.redirect('/orders');
  }
});

(async () => {
  await sequelize.sync();
  app.listen(3001, () => {
    console.log('Order service running on port 3001');
  });
})();

