const express = require("express");
const fetch = require("node-fetch");
require("dotenv/config");


const app = express();

const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PORT = 3000 } = process.env;
const base = "https://api-m.sandbox.paypal.com";


app.set('view engine', 'ejs');
app.set('views', './server/views');

app.use(express.static('src'));
app.use(express.urlencoded({ extended:true }));


// parse post params sent in body in json format
app.use(express.json());

let amount = 1;

/**
 * Generate an OAuth 2.0 access token for authenticating with PayPal REST APIs.
 * @see https://developer.paypal.com/api/rest/authentication/
 */
const generateAccessToken = async () => {
  try {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      throw new Error("MISSING_API_CREDENTIALS");
    }
    const auth = Buffer.from(
      PAYPAL_CLIENT_ID + ":" + PAYPAL_CLIENT_SECRET,
    ).toString("base64");
    const response = await fetch(`${base}/v1/oauth2/token`, {
      method: "POST",
      body: "grant_type=client_credentials",
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error("Failed to generate Access Token:", error);
  }
};

/**
 * Generate a client token for rendering the hosted card fields.
 * @see https://developer.paypal.com/docs/checkout/advanced/integrate/#link-integratebackend
 */
const generateClientToken = async () => {
  const accessToken = await generateAccessToken();
  const url = `${base}/v1/identity/generate-token`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Accept-Language": "en_US",
      "Content-Type": "application/json",
    },
  });

  return handleResponse(response);
};

/**
 * Create an order to start the transaction.
 * @see https://developer.paypal.com/docs/api/orders/v2/#orders_create
 */
const createOrder = async (cart) => {
  // use the cart information passed from the front-end to calculate the purchase unit details
  console.log(
    "shopping cart information passed from the frontend createOrder() callback:",
    cart,
  );

  const accessToken = await generateAccessToken();
  const url = `${base}/v2/checkout/orders`;
  const payload = {
    intent: "CAPTURE",
    purchase_units: [
      {
        amount: {
          currency_code: "USD",
          value: amount,
        },
      },
    ],
  };

  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      // Uncomment one of these to force an error for negative testing (in sandbox mode only). Documentation:
      // https://developer.paypal.com/tools/sandbox/negative-testing/request-headers/
      // "PayPal-Mock-Response": '{"mock_application_codes": "MISSING_REQUIRED_PARAMETER"}'
      // "PayPal-Mock-Response": '{"mock_application_codes": "PERMISSION_DENIED"}'
      // "PayPal-Mock-Response": '{"mock_application_codes": "INTERNAL_SERVER_ERROR"}'
    },
    method: "POST",
    body: JSON.stringify(payload),
  });

  return handleResponse(response);
};

/**
 * Capture payment for the created order to complete the transaction.
 * @see https://developer.paypal.com/docs/api/orders/v2/#orders_capture
 */
const captureOrder = async (orderID) => {
  const accessToken = await generateAccessToken();
  const url = `${base}/v2/checkout/orders/${orderID}/capture`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      // Uncomment one of these to force an error for negative testing (in sandbox mode only). Documentation:
      // https://developer.paypal.com/tools/sandbox/negative-testing/request-headers/
      // "PayPal-Mock-Response": '{"mock_application_codes": "INSTRUMENT_DECLINED"}'
      // "PayPal-Mock-Response": '{"mock_application_codes": "TRANSACTION_REFUSED"}'
      // "PayPal-Mock-Response": '{"mock_application_codes": "INTERNAL_SERVER_ERROR"}'
    },
  });

  return handleResponse(response);
};


/**
 * Capture payment for the created order to complete the transaction.
 * @see https://developer.paypal.com/docs/api/orders/v2/#orders_capture
 */

const onBoard = async () => {
  const accessToken = await generateAccessToken();
  const url = `${base}/v2/customer/partner-referrals`;

  const response = await fetch(url, {

    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({"individual_owners": [ { "names": [ { "prefix": "Mr.", "given_name": "John", "surname": "Doe", "middle_name": "Middle", "suffix": "Jr.", "full_name": "John Middle Doe Jr.", "type": "LEGAL" } ], "citizenship": "US", "addresses": [ { "address_line_1": "One Washington Square", "address_line_2": "Apt 123", "admin_area_2": "San Jose", "admin_area_1": "CA", "postal_code": "95112", "country_code": "US", "type": "HOME" } ], "phones": [ { "country_code": "1", "national_number": "6692468839", "extension_number": "1234", "type": "MOBILE" } ], "birth_details": { "date_of_birth": "1955-12-29" }, "type": "PRIMARY" } ],"operations": [ { "operation": "BANK_ADDITION" } ]})
});
  return handleResponse(response);
};

async function handleResponse(response) {
  try {
    const jsonResponse = await response.json();
    return {
      jsonResponse,
      httpStatusCode: response.status,
    };
  } catch (err) {
    const errorMessage = await response.text();
    throw new Error(errorMessage);
  }
}

// // render checkout page with client id & unique client token
// app.get("/", async (req, res) => {
//   try {
//     const { jsonResponse } = await generateClientToken();
//     res.render("checkout", {
//       clientId: PAYPAL_CLIENT_ID,
//       clientToken: jsonResponse.client_token,
//     });
//   } catch (err) {
//     res.status(500).send(err.message);
//   }
// });


app.get('/', (req,res) => {
  res.render('index', {title: 'Home'});
});

app.get('/about', (req,res) => {
  res.render('about', {title: 'About'});
});

app.get('/contact', (req,res) => {
  res.render('contact', {title: 'Contact'});
});

app.get('/blogs', (req,res) => {
  res.render('blogs', {title: 'Blogs'});
});

app.get("/buy", async (req, res) => {
  try {
    const { jsonResponse } = await generateClientToken();
    res.render("buy", { title: 'Buy', amount: 100, clientId: PAYPAL_CLIENT_ID,
      clientToken: jsonResponse.client_token,
    });
    console.log(req.body);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post("/buy", async (req, res) => {
  try {
    const { jsonResponse } = await generateClientToken();
    res.render("buy", { title: 'Buy', amount: req.body['buy-crypto'], clientId: PAYPAL_CLIENT_ID,
      clientToken: jsonResponse.client_token,
    });
    console.log(req.body);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post("/api/orders", async (req, res) => {
  try {
    // use the cart information passed from the front-end to calculate the order amount detals
    amount = req.body['crypto_amount'];

    const { cart } = req.body;
    const { jsonResponse, httpStatusCode } = await createOrder(cart);
    res.status(httpStatusCode).json(jsonResponse);
  } catch (error) {
    console.error("Failed to create order:", error);
    res.status(500).json({ error: "Failed to create order." });
  }
});

app.post("/api/orders/:orderID/capture", async (req, res) => {
  try {
    const { orderID } = req.params;
    const { jsonResponse, httpStatusCode } = await captureOrder(orderID);
    res.status(httpStatusCode).json(jsonResponse);
z  } catch (error) {
    console.error("Failed to create order:", error);
    res.status(500).json({ error: "Failed to capture order." });
  }
});

// render checkout page with client id & unique client token
app.post("/onboard", async (req, res) => {
  try {
    const { jsonResponse } = await onBoard();
    console.log(jsonResponse);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.listen(PORT, () => {
  console.log(`Node server listening at http://localhost:${PORT}/`);
});
