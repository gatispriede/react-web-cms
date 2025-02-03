import {
    Button
} from "@chakra-ui/react";
import {
    DialogActionTrigger,
    DialogBody, DialogCloseTrigger,
    DialogContent,
    DialogFooter,
    DialogHeader, DialogRoot,
    DialogTitle,
    DialogTrigger
} from "../ui/dialog";
import React from "react";


const DeleteConfirmationDialog = ({isOpen, onClose, onDelete}) => {

    return (
        <>
            <DialogRoot>
                <DialogTrigger asChild>
                    <Button colorScheme='red' >
                        Delete Customer
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add new navigation item</DialogTitle>
                    </DialogHeader>
                    <DialogBody>
                        <label>You sure you want to delete?</label>
                    </DialogBody>
                    <DialogFooter>
                        <DialogActionTrigger asChild>
                            <Button>
                                Cancel
                            </Button>
                        </DialogActionTrigger>
                        <DialogActionTrigger asChild>
                            <Button colorScheme='red' onClick={onDelete()} ml={3}>
                                Delete
                            </Button>
                        </DialogActionTrigger>
                    </DialogFooter>
                    <DialogCloseTrigger/>
                </DialogContent>
            </DialogRoot>
        </>
    )
}

export default DeleteConfirmationDialog;