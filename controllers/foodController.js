require('dotenv').config();
const { StatusCodes } = require('http-status-codes');
const CustomError = require('../errors');

const path = require('path');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Food = require('../models/Food');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const runGemini = async (ingredients) => {
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
  let prompt = `
    You're a nutrition expert who has been assessing packaged food products for their nutritional value, health benefits, and potential risks for over a decade. However, you specialize in analyzing detailed JSON data of food items to generate comprehensive reports on their quality, impact on human health, and the long-term advantages and disadvantages of consuming those ingredients, including the likelihood of causing diseases or health issues.

    Your task is to examine the JSON data of a packaged food item and generate a detailed report. The data includes information on the food's name, food's nutritional content, ingredients, and serving sizes if applicable. 

    Your report should cover the overall quality of the food, whether it should be consumed or daily basis/multiple times a day or not, highlighting any potential benefits for human health, as well as the disadvantages of long-term consumption of certain ingredients. 
    Additionally, analyze if any of the ingredients could potentially lead to specific diseases, sicknesses, or health issues in consumers.

    Strictly maintain structure like this
    - Rating out of 10 
    - Analysis (pros and cons)
    - Potential Health Risk.
    - Harmful ingredients details

    ---

    For example, if you evaluate the JSON data of a granola bar, you would consider factors such as the presence of whole grains (beneficial for heart health and digestion), added sugars (increased risk of obesity and diabetes), and artificial preservatives (possible links to certain cancers or allergic reactions). 

    Your report should provide insights that help consumers make informed decisions about their food choices to consume it daily, based on the data analysis and health implications derived from the information provided.
     
    Your response should be STRICTLY in RFC8259 compliant JSON format like this:
    {rating:"...", pros:["..."], cons:["..."], healthRisk:["..."], harmfulIngredients: {"ingredientName": "reason"}}
`;

  prompt += JSON.stringify(ingredients);

  const result = await model.generateContent(prompt);
  const response = await result.response.text();
  return response;
};

const fileToGenerativePart = (path, mimeType) => {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(path)).toString('base64'),
      mimeType,
    },
  };
};

const runGeminiVision = async (image, mimeType) => {
  const model = genAI.getGenerativeModel({ model: 'gemini-pro-vision' });

  const prompt = `Do OCR of image and respond in json format.
    Your response should be in JSON format like this:
    {nutritionInfo:{protein:"X g per 100g",sugar:"...", //other fields}, ingredients:{...}}
    
    Remember that there should not be any new line (\n) neither codeblocks(${'```'}) nor any useless spaces in the response.`;

  const imageParts = [fileToGenerativePart(image, mimeType)];

  const result = await model.generateContent([prompt, ...imageParts]);
  const response = await result.response.text();
  return response;
};

const getFromDB = async (foodName) => {
  const name = foodName.trim().toLowerCase();
  return await Food.findOne({ name });
};

const storeInDb = async (foodName, result) => {
  const name = foodName.trim().toLowerCase();
  return await Food.create({ name, result });
};

const getDetails = async (req, res) => {
  ///////////////////////////////////////
  // get img
  if (!req.files) {
    throw new CustomError.BadRequestError('No File Uploaded');
  }

  const productName = req.body.name;
  const productImage = req.files.image;

  ///////////////////////////////////////
  // check in db
  const dataExists = await getFromDB(productName);

  ///////////////////////////////////////
  // if found in db return
  if (dataExists) {
    console.log('🟢 data found in db');

    return res
      .status(StatusCodes.OK)
      .json({ msg: 'success', data: dataExists.result });
  }

  ///////////////////////////////////////
  // check format
  if (!productImage.mimetype.startsWith('image')) {
    throw new BadRequestError('Please Upload Image');
  }

  ///////////////////////////////////////
  // save image in local
  const imagePath = path.join(
    __dirname,
    '../public/uploads/' + `${productImage.name}`
  );

  await productImage.mv(imagePath);

  ///////////////////////////////////////
  // run gemini to do OCR
  const ocrResponse = await runGeminiVision(imagePath, productImage.mimetype);

  console.log(ocrResponse);
  let ocrJson = JSON.parse(
    ocrResponse
      .trim()
      .substring(8, ocrResponse.length - 4)
      .trim()
  );

  ocrJson.name = productName;
  console.log(ocrJson);

  ///////////////////////////////////////
  // run gemini to get food data
  const response = await runGemini(ocrJson);
  console.log(response);

  let msg = 'success';
  let final;

  try {
    console.log('🔵 Response type ', typeof response);

    if (typeof response === 'object') {
      final = response;
    } else {
      console.log('🟡 trying normal parsing method');
      final = JSON.parse(response);
      console.log('🟢 normal parsing method worked ');
    }
  } catch (error) {
    console.log('🔴 error parsing json ', error);
    try {
      console.log('🟡 trying different parse method');
      final = JSON.parse(
        response
          .trim()
          .substring(8, response.length - 4)
          .trim()
      );
    } catch (error) {
      console.log('🔴 error parsing through second method', error);
      final = {};
      msg = 'failed';
    }
  }

  ///////////////////////////////////////
  // store in db
  if (msg === 'success') {
    console.log('🔵 no data found, storing in db');
    await storeInDb(productName, final);
  }

  res.status(StatusCodes.OK).json({ msg, data: final });
};

module.exports = { getDetails };
