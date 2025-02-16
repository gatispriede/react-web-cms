import { NextResponse } from "next/server";
import path from "path";
import { writeFile } from "fs/promises";

const POST = async (req: { formData: () => any; }, res: any) => {
    const formData = await req.formData();

    const file = formData.get("file");
    if (!file) {
        return NextResponse.json({ error: "No files received." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename =  file.name.replaceAll(" ", "_");
    console.log(filename);
    try {
        await writeFile(
            path.join(process.cwd(), "public/images/" + filename),
            buffer
        );
        return NextResponse.json({ Message: "Success", status: 201 });
    } catch (error) {
        console.log("Error occured ", error);
        return NextResponse.json({ Message: "Failed", status: 500 });
    }
};

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb',
        },
    },
}

export default POST