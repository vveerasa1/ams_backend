const path = require("path");
const AWS = require("aws-sdk");
const { v4: uuidv4 } = require("uuid");
const config = require("../config");

const s3 = new AWS.S3({
  accessKeyId: config.s3.AWS_ACCESS_KEY_ID,
  secretAccessKey: config.s3.AWS_SECRET_ACCESS_KEY,
  region: "us-east-1",
});

const s3Uploads = async (file, folder) => {
  const fileExtension = path.extname(file.originalname);
  const uniqueFileName = `${uuidv4()}${fileExtension}`;
  const key = `${folder}/${uniqueFileName}`;

  const uploadParams = {
    Bucket: config.s3.AWS_S3_BUCKET_NAME,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  // Upload to S3
  const s3Result = await s3.upload(uploadParams).promise();
  return s3Result.Location;
};

const deleteFromS3 = async (key) => {
  const params = {
    Bucket: config.s3.AWS_S3_BUCKET_NAME,
    Key: key,
  };

  await s3.deleteObject(params).promise();
};

module.exports = {
  s3Uploads,
  deleteFromS3,
};
