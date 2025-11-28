import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import path from "path";

const s3Client = new S3Client({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

export const uploadToS3 = async (file, userId) => {
    const fileExtension = path.extname(file.originalname);
    const fileName = `recordings/${userId}/${Date.now()}-${file.originalname}`;

    const params = {
        Bucket: process.env.AWS_S3_BUCKET,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
    };

    const command = new PutObjectCommand(params);
    await s3Client.send(command);

    const fileUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION || "us-east-1"}.amazonaws.com/${fileName}`;

    return {
        fileName: file.originalname,
        fileUrl,
        fileSize: file.size,
        key: fileName,
    };
};

export default s3Client;
