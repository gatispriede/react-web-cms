import {
    Button,
    createListCollection,
    Input, SelectContent, SelectItem,
    SelectLabel,
    SelectRoot,
    SelectTrigger,
    SelectValueText
} from "@chakra-ui/react"
import {
    DialogActionTrigger,
    DialogBody,
    DialogCloseTrigger,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogRoot,
    DialogTitle,
    DialogTrigger,
} from "../ui/dialog"
import {PlusSquareDotted} from "@styled-icons/bootstrap/PlusSquareDotted"

const fieldTypes = createListCollection({
    items: [
        { label: "Simple Text", value: "TEXT" },
        { label: "Rich text", value: "RICH_TEXT" },
        { label: "Image", value: "IMAGE" },
        { label: "Image with text", value: "IMAGE_WITH_TEXT" },
        { label: "Carousel of images", value: "CAROUSEL" },
    ],
})

const AddNewSectionItem = () => {
    return (
        <DialogRoot>
            <DialogTrigger  asChild>
                <Button variant="outline" size="sm" >
                    <PlusSquareDotted />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add new section item</DialogTitle>
                </DialogHeader>
                <DialogBody>
                    <SelectRoot collection={fieldTypes} size="sm" width="320px">
                        <SelectLabel>Select type</SelectLabel>
                        <SelectTrigger>
                            <SelectValueText placeholder="Select item type" />
                        </SelectTrigger>
                        <SelectContent>
                            {fieldTypes.items.map((item) => (
                                <SelectItem item={item} key={item.value}>
                                    {item.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </SelectRoot>
                </DialogBody>
                <DialogFooter>
                    <DialogActionTrigger asChild>
                        <Button variant="outline">Cancel</Button>
                    </DialogActionTrigger>
                    <DialogActionTrigger asChild>
                        <Button onClick={() => {
                            console.log('change')}}>Save</Button>
                    </DialogActionTrigger>
                </DialogFooter>
                <DialogCloseTrigger />
            </DialogContent>
        </DialogRoot>
    )
}

export default AddNewSectionItem