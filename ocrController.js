import { ImageAnnotatorClient } from '@google-cloud/vision';
import { readFile, readFileSync, writeFile } from 'fs';
import { createWorker } from 'tesseract.js';

async function detectTextFromImageUsingTesseract(req, res) {
    try {
        const worker = await createWorker();
        await worker?.loadLanguage('eng');
        await worker?.initialize('eng');
        const { data: { text } } = await worker?.recognize('./img/AnchorExpense.png');
        let textArray = text.split('\n');
        writeFile('anchorExpense_info_tesseract.txt', text, (err) => {
            if (err) {
                console.error(err);
            } else {
                console.log('Expense information stored successfully');
            }
        });
        const invoiceInfo: any = {
            invoiceNumber: null,
            invoiceDate: null,
            dueDate: null,
            customerName: null
        }
        const datePattern = /(\d{1,2})\/(\d{1,2})\/(\d{4})/
        const currencyPattern2 = /\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g
        const currencyPattern =
            /([$€£]\s?\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{2})?|\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{2})?\s?[$€£])/

        const emailPattern = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/

        const invoiceRegx = /INV-\w+/

        try {
            textArray.forEach((text, index) => {
                if (
                    text.toLowerCase().includes('invoice date') ||
                    text.toLowerCase().includes('date issued')
                ) {
                    invoiceInfo['invoiceDate'] = textArray[index].includes(
                        ':'
                    )
                        ? new Date(
                              textArray[index]?.split(':')[1]?.trim()
                          ).getTime()
                        : new Date(
                              textArray[index + 1]
                                  ?.trim()
                                  ?.match(datePattern)[2] +
                                  '/' +
                                  textArray[index + 1]
                                      ?.trim()
                                      ?.match(datePattern)[1] +
                                  '/' +
                                  textArray[index + 1]
                                      ?.trim()
                                      .match(datePattern)[3]
                          ).getTime()
                }
                if (
                    text.toLowerCase().includes('invoice no') ||
                    text.toLowerCase().includes('invoice number') ||
                    text.toLowerCase().includes('inv-')
                ) {
                    invoiceInfo['invoiceNumber'] = textArray[
                        index
                    ].includes(':')
                        ? textArray[index]?.split(':')[1]?.trim()
                        : textArray[index]?.trim()?.match(invoiceRegx)
                        ? textArray[index]?.trim()?.match(invoiceRegx)[0]
                        : textArray[index]?.trim()
                }
                if (text.toLowerCase().includes('due date')) {
                    invoiceInfo['dueDate'] = textArray[index].includes(':')
                        ? new Date(
                              textArray[index]?.split(':')[1]?.trim()
                          ).getTime()
                        : new Date(
                              textArray[index + 1]
                                  ?.trim()
                                  ?.match(datePattern)[2] +
                                  '/' +
                                  textArray[index + 1]
                                      ?.trim()
                                      ?.match(datePattern)[1] +
                                  '/' +
                                  textArray[index + 1]
                                      ?.trim()
                                      .match(datePattern)[3]
                          ).getTime()
                }
                if (
                    text.toLowerCase().includes('bill to') ||
                    text.toLowerCase().includes('billed to')
                ) {
                    invoiceInfo['customerName'] =
                        textArray[index + 1]?.trim()?.split(' ')[0] +
                            ' ' +
                            textArray[index + 1]?.trim()?.split(' ')[1] !==
                            'Invoice' &&
                        textArray[index + 1]?.trim()?.split(' ')[0]
                }
                if (text.toLowerCase().includes('company')) {
                    invoiceInfo['customerCompany'] = textArray[
                        index
                    ].includes(':')
                        ? textArray[index]?.split(':')[1]?.trim()
                        : textArray[index + 1]?.trim()
                }
                if (
                    text.toLowerCase().includes('email') &&
                    (textArray[index + 1]?.trim()?.match(emailPattern) ||
                        textArray[index]?.trim()?.match(emailPattern))
                ) {
                    invoiceInfo['customerEmail'] = textArray[
                        index
                    ].includes(':')
                        ? textArray[index]
                              ?.split(':')[1]
                              ?.trim()
                              ?.match(emailPattern)[0]
                        : textArray[index + 1]
                              ?.trim()
                              ?.match(emailPattern)[0]
                }
                if (
                    text.toLowerCase().includes('phone') &&
                    textArray[index].includes(':')
                ) {
                    invoiceInfo['customerPhone'] = textArray[index]
                        ?.split(':')[1]
                        ?.trim()
                }
                if (
                    text.toLowerCase().includes('sub total') ||
                    text.toLowerCase().includes('subtotal')
                ) {
                    invoiceInfo['subTotal'] = text
                        .toLowerCase()
                        .includes('sub total')
                        ? textArray[index]
                              .toLowerCase()
                              .trim()
                              .split('sub total')[1]
                        : textArray[index]
                              .toLowerCase()
                              .trim()
                              .split('subtotal')[1]
                    if (invoiceInfo['subTotal']?.match(currencyPattern)) {
                        invoiceInfo['subTotal'] = parseFloat(
                            invoiceInfo['subTotal']?.replace(
                                /[$€£,\s]/g,
                                ''
                            )
                        )
                    }
                }
                if (text.toLowerCase().includes('total')) {
                    invoiceInfo['total'] = textArray[index]
                        ?.toLowerCase()
                        ?.trim()
                        ?.split('total ')[1]

                    if (invoiceInfo['total']?.match(currencyPattern)) {
                        invoiceInfo['total'] = parseFloat(
                            invoiceInfo['total']?.replace(/[$€£,\s]/g, '')
                        )
                    }
                }
                if (
                    text.toLowerCase().includes('balance due') ||
                    text.toLowerCase().includes('amount due')
                ) {
                    invoiceInfo['balanceDue'] = text
                        .toLowerCase()
                        .includes('balance due')
                        ? textArray[index]
                              ?.toLowerCase()
                              ?.trim()
                              ?.split('balance due ')[1]
                        : textArray[index + 1]?.match(currencyPattern2)[0]
                    if (
                        invoiceInfo['balanceDue']?.match(currencyPattern2)
                    ) {
                        invoiceInfo['balanceDue'] = parseFloat(
                            invoiceInfo['balanceDue']?.replace(
                                /[$€£,\s]/g,
                                ''
                            )
                        )
                    }
                }
            })
        } catch (error) {
            console.error(error)
        }
        // Find the start of the tabular data (where the line contains '# Item & Description Qty Rate Amount')
        const tabularData = []
        const startIndex = textArray.findIndex(
            (line) =>
                line
                    .toLowerCase()
                    .includes('# item & description qty rate amount') ||
                line.toLowerCase().includes('rate amount') ||
                line.toLowerCase().includes('description')
        )
        if (startIndex !== -1) {
            for (let i = startIndex + 1; i < textArray.length; i++) {
                const line = textArray[i]
                // const itemArray = line?.trim()?.split(' ')
                const itemArray = line?.trim()?.split(/\s+/)
                let itemDesc = ''
                if (
                    parseInt(itemArray[0]) &&
                    // parseInt(itemArray[itemArray.length - 1]) &&
                    (!parseFloat(itemArray[1]) ||
                        !itemArray[1]?.match(currencyPattern)) &&
                    !isNaN(parseInt(itemArray[2])) &&
                    itemArray.length >= 5
                ) {
                    itemDesc = itemArray[1]
                    if (!itemArray[2]?.match(currencyPattern)) {
                        itemDesc += ' ' + itemArray[2]
                    }
                } else if (
                    // parseInt(itemArray[0]) &&
                    // parseInt(itemArray[itemArray.length - 1]) &&
                    isNaN(parseInt(itemArray[0])) &&
                    (!isNaN(parseInt(itemArray[itemArray.length - 1])) ||
                        !isNaN(
                            parseInt(itemArray[itemArray.length - 2])
                        )) &&
                    // parseInt(itemArray[2]) &&
                    itemArray.length >= 4
                ) {
                    itemDesc = itemArray[0]
                } else {
                    // items if item description is more than one word
                    itemArray.forEach((item) => {
                        // if (isNaN(parseInt(item))) {
                        if (
                            !item?.match(currencyPattern) &&
                            !parseFloat(item)
                        ) {
                            itemDesc += item + ' '
                        }
                    })
                }

                if (
                    !isNaN(parseInt(itemArray[0])) &&
                    (!isNaN(parseInt(itemArray[itemArray.length - 3])) ||
                        !isNaN(
                            parseInt(itemArray[itemArray.length - 4])
                        )) &&
                    // !isNaN(parseInt(itemArray[itemArray.length - 2])) &&
                    // !isNaN(parseInt(itemArray[itemArray.length - 1])) &&
                    itemDesc.length > 0
                ) {
                    const rowData: any = {
                        itemNumber: !isNaN(parseInt(itemArray[0]))
                            ? parseInt(itemArray[0])
                            : null,
                        item: itemDesc,
                        quantity: !isNaN(
                            parseFloat(itemArray[itemArray.length - 3])
                        )
                            ? parseFloat(itemArray[itemArray.length - 3])
                            : parseFloat(itemArray[itemArray.length - 4]),
                        rate:
                            itemArray[itemArray.length - 2]?.match(
                                currencyPattern
                            ) ||
                            !isNaN(
                                parseFloat(itemArray[itemArray.length - 2])
                            )
                                ? itemArray[itemArray.length - 2]
                                : itemArray[itemArray.length - 3],
                        total: itemArray[itemArray.length - 1]
                    }
                    rowData.rate = parseFloat(
                        rowData?.rate?.replace(/[$€£,\s]/g, '')
                    )

                    rowData.total = parseFloat(
                        rowData?.total?.replace(/[$€£,\s]/g, '')
                    )
                    if (
                        rowData?.total <
                        rowData?.rate * rowData?.quantity
                    ) {
                        rowData.total = rowData?.rate * rowData?.quantity
                    }
                    tabularData.push(rowData)
                } else if (
                    isNaN(parseInt(itemArray[0])) &&
                    (!isNaN(parseInt(itemArray[itemArray.length - 2])) ||
                        !isNaN(
                            parseInt(itemArray[itemArray.length - 3])
                        )) &&
                    // !isNaN(parseInt(itemArray[itemArray.length - 2])) &&
                    // !isNaN(parseInt(itemArray[itemArray.length - 1])) &&
                    itemDesc.length > 0
                ) {
                    const rowData: any = {
                        itemNumber: null,
                        item: itemDesc,
                        rate: itemArray[itemArray.length - 3],
                        quantity: !isNaN(
                            parseFloat(itemArray[itemArray.length - 2])
                        )
                            ? parseFloat(itemArray[itemArray.length - 2])
                            : itemArray[itemArray.length - 3],
                        total: itemArray[itemArray.length - 1]
                    }
                    rowData.rate = parseFloat(
                        rowData?.rate?.replace(/[$€£,\s]/g, '')
                    )

                    rowData.total = parseFloat(
                        rowData?.total?.replace(/[$€£,\s]/g, '')
                    )
                    if (
                        rowData?.total <
                        rowData?.rate * rowData?.quantity
                    ) {
                        rowData.total = rowData?.rate * rowData?.quantity
                    }
                    tabularData.push(rowData)
                }
            }
            invoiceInfo['products'] = tabularData
        } else {
            invoiceInfo['products'] = []
        }
        await worker.terminate()
        return res.status(200).json(
            invoiceInfo
        )
    } catch (error) {
        console.error(error);
        return res.status(500).json(
            error.toString()
        )
    }
}



async function detectTextFromImageUsingVision(req, res) {
    try {
        const imagePath = './img/invoice-1.jpg';
        // Instantiates a client
        const client = new ImageAnnotatorClient({
            // keyFilename: './private/anchorbooks-ocr-22132c92e2d5.json'
            keyFilename: './'
        });

        // const request = {
        //     image: {
        //       source: {
        //         uri: imagePath,
        //       },
        //     },
        //     features: [
        //       {
        //         type: 'TEXT_DETECTION',
        //       },
        //     ],
        //   };
          
        //   await client.textDetection(request, (err, response) => {
        //     if (err) {
        //       console.error(err);
        //     } else {
        //         console.log('res\n', response, '\nres')
        //       const textAnnotations = response.textAnnotations;
        //         console.log('textAnnotations\n',textAnnotations)
        //       const invoiceInfo = {};
          
        //       for (const textAnnotation of textAnnotations) {
        //         const boundingBox = textAnnotation.boundingBoxes[0];
        //         const text = textAnnotation.description;
          
        //         invoiceInfo[text] = boundingBox;
        //       }
          
        //       writeFile('invoice_info.json', JSON.stringify(invoiceInfo), (err) => {
        //         if (err) {
        //           console.error(err);
        //         } else {
        //           console.log('Invoice information stored successfully');
        //         }
        //       });
        //     }
        //   });

        //   return res.status(200).json(
        //     'ocr'
        //   )

        // client.labelDetection(imagePath).then((res) => {
        //     console.log(res)
        //     const labels = res[0].labelAnnotations;

        // }).catch((err) => {
        //     console.error(err)
        // })


        // const [result] = await client.textDetection(imagePath).then((res) => {
        //     console.log(res)
        //     const labels = res[0].textAnnotations;
        //     console.log('textAnnotations\n', labels)
        //     console.log('fullPageText\n', res[0].fullTextAnnotation.text)
        //     // console.log('fullPage\n', res[0].fullTextAnnotation.pages)
        //      // Read the image file
        //     const imageFile = readFile(imagePath);

        //     // Convert the image file to base64 encoded string
        //     const encodedImage = imageFile.toString('base64');

        //     image: { content: encodedImage }
        // }).catch((err) => {
        //     console.error(err)
        // })

        // const detections = result.textAnnotations;
        // const extractedText = detections[0].description; // The first annotation contains the entire detected text
        // console.log('-------------ExtractedText--------------')
        // console.log(extractedText)

        // return res.status(200).json(
        //     extractedText.toString()
        // )
        // Read the image file
        const imageFile =  readFileSync(imagePath);
    
        // Convert the image file to base64 encoded string
        const encodedImage = imageFile?.toString('base64');
    
        // Make a request to the Vision API to detect text
        const [result] = await client?.textDetection({
            image: { content: encodedImage },
        });
    
        // Extract the text from the response
        // console.log({result});

        const invoiceInfo = {};
        // console.log(result.textAnnotations[0].description)
        console.log(result.textAnnotations[0].boundingPoly.vertices)
          
        // for (const textAnnotation of result.textAnnotations) {
            // console.log(textAnnotation?.description)

            // const boundingBox = textAnnotation.description;
            // console.log({boundingBox})
            // const boundingBox = textAnnotation.boundingBoxes[0];
            // const text = textAnnotation.description;
          
            // invoiceInfo[text] = boundingBox;
        // }

        writeFile('invoice_info_anchor.txt', result.textAnnotations[0].boundingPoly.vertices.toString(), (err) => {
            if (err) {
                console.error(err);
            } else {
                console.log('Invoice information stored successfully');
            }
        });
        console.log({invoiceInfo})

        // const detections = result.textAnnotations;
        // const extractedText = detections[0].description; // The first annotation contains the entire detected text
        // console.log('-------------ExtractedText--------------')
        // console.log(extractedText)
        
        // console.log(extractedText)
        return res.status(200).json(
            // extractedText.toString()
            'ocr'
        )
    } catch (error) {
        console.error(error);
        return res.status(500).json(
            error.toString()
        )
    }
}



const main = async (req, res) => {
    res.status(200).json(
        'hello world'
    )
}

export {
    main,
    // detectTextFromImageUsingVision,
    detectTextFromImageUsingTesseract
}