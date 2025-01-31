import {Button, Input } from "@chakra-ui/react"
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

const AddNewDialogNavigation = () => {
    return (
        <DialogRoot>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <PlusSquareDotted />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add new navigation item</DialogTitle>
                </DialogHeader>
                <DialogBody>
                    <label>Enter name</label>
                    <Input  />
                </DialogBody>
                <DialogFooter>
                    <DialogActionTrigger asChild>
                        <Button variant="outline">Cancel</Button>
                    </DialogActionTrigger>
                    <DialogActionTrigger asChild>
                        <Button>Save</Button>
                    </DialogActionTrigger>
                </DialogFooter>
                <DialogCloseTrigger />
            </DialogContent>
        </DialogRoot>
    )
}

export default AddNewDialogNavigation