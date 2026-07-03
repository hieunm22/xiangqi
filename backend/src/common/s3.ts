import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"

const region = process.env.AWS_REGION || "us-east-1"

const accessKeyId = process.env.AWS_ACCESS_ID
const secretAccessKey = process.env.AWS_SECRET_KEY

const s3Client = new S3Client({
	region,
	...(accessKeyId && secretAccessKey
		? {
			credentials: {
				accessKeyId,
				secretAccessKey
			}
		}
		: {})
})

export const uploadBufferToS3 = async (
	bucket: string,
	key: string,
	buffer: Buffer,
	contentType: string
) => {
	await s3Client.send(new PutObjectCommand({
		Bucket: bucket,
		Key: key,
		Body: buffer,
		ContentType: contentType
	}))
}
