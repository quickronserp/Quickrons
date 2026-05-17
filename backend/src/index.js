const express = require("express");
const cors = require("cors");
const app = express();
app.use(cors());
app.use(express.json());
app.get("/health",(req,res)=>{res.json({status:"Quickrons backend live"});});
const PORT = process.env.PORT || 8080;
app.listen(PORT,"0.0.0.0",()=>{console.log(`Server running on port ${PORT}`);});
