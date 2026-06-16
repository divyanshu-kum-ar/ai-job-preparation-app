const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

require("dotenv").config({ override: true })
const app = require("./src/app")
const connectToDB = require("./src/config/database")

connectToDB()


app.listen(3000, () => {
    console.log("Server is running on port 3000")
})