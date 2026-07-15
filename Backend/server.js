const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

require("dotenv").config({ override: true })
const app = require("./src/app")
const connectToDB = require("./src/config/database")

connectToDB()


const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
})