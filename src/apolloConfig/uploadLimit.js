// A request over the server's upload limit (nginx's client_max_body_size in production) is refused with 413 before it
// reaches the API, so the API can't say why: the limit is the server's alone, and this is where the front end learns it.
export const UPLOAD_TOO_LARGE_MESSAGE =
    'The file is larger than the server accepts. Upload a smaller file, or ask the administrator about the size limit.'

/** Gives a network error for a request over the upload limit a message to show, in place of the bare status */
export const explainUploadTooLarge = (networkError) => {
    if (networkError?.statusCode === 413) {
        networkError.message = UPLOAD_TOO_LARGE_MESSAGE
    }
}
