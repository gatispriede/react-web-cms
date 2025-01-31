import {Button, Input} from "@chakra-ui/react"
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
import React from "react";
import {resolve} from '../../gqty'

class AddNewDialogNavigation extends React.Component {
    sections: string[] = []
    state = {
        newNavigationName: ''
    }
    private count = 0

    constructor(props: {}) {
        super(props)
        this.state = {
            newNavigationName: ''
        }
    }

    set newNavigationName(value: string) {
        this.setState({newNavigationName: value})
    }

    public async createNavigation() {

        const result = await resolve(
            ({mutation}) => {
                const update = {
                    pageName: this.state.newNavigationName
                }
                if (this.sections.length > 0) {
                    update.sections = this.sections
                }
                return mutation.mongo.addUpdateNavigationItem(update)
            },
        );
        console.log(result)
    }

    render() {
        return (
            <DialogRoot>
                <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                        <PlusSquareDotted/>
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add new navigation item</DialogTitle>
                    </DialogHeader>
                    <DialogBody>
                        <label>Enter name</label>
                        <Input value={this.state.newNavigationName}
                               onChange={(input) => this.newNavigationName = input.target.value}/>
                    </DialogBody>
                    <DialogFooter>
                        <DialogActionTrigger asChild>
                            <Button variant="outline">Cancel</Button>
                        </DialogActionTrigger>
                        <DialogActionTrigger asChild>
                            <Button disabled={this.state.newNavigationName.length < 3} onClick={() => {
                                this.createNavigation()
                            }}>Save</Button>
                        </DialogActionTrigger>
                    </DialogFooter>
                    <DialogCloseTrigger/>
                </DialogContent>
            </DialogRoot>
        )
    }
}

export default AddNewDialogNavigation