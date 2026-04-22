setup-env:
	yarn
	git checkout HEAD -- yarn.lock

reset:
	rm -rf dist
	rm -rf node_modules
	rm -rf coverage
	rm -f .env.local
	git reset --hard

destroy:
	docker container stop xiangqi
	docker container rm xiangqi
	docker image rm xiangqi

docker:
	docker build -t xiangqi -f Dockerfile .
	docker run --name xiangqi -ditp 9999:80 --restart unless-stopped xiangqi

publish:
	yarn build
	make destroy
	make docker

start:
	make setup-env
	yarn dev

package:
	yarn
	git checkout HEAD -- yarn.lock
	yarn dev
